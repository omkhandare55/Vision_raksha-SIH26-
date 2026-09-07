# backend/ai/gradcam.py
# Module 4 — Grad-CAM Explainability
# Spec: TRD Section 4.4
# Generates heatmap showing WHICH retinal regions drove the AI decision

import io
import base64
import logging
import threading
import numpy as np
import cv2
from PIL import Image
import torch

logger = logging.getLogger(__name__)


class GradCAMEngine:
    """
    Gradient-weighted Class Activation Mapping.

    Formula (TRD 4.4):
        α_k^c  = (1/Z) Σ_ij  ∂y^c / ∂A_ij^k
        L^c    = ReLU( Σ_k  α_k^c · A^k )

    Uses PyTorch forward/backward hooks on EfficientNet-B4's
    last conv layer (conv_head).
    """

    def __init__(self, model: torch.nn.Module, device: str = "cpu"):
        self.model      = model
        self.device     = device
        self._acts      = None   # forward activations
        self._grads     = None   # backward gradients
        self._hooks     = []
        self._lock      = threading.Lock()
        self._register_hooks()

    # ── Public API ───────────────────────────────────────────

    def generate(
        self,
        tensor:     torch.Tensor,    # (1,3,H,W) from DRGrader.preprocess()
        class_idx:  int,             # grade index to explain
        original:   np.ndarray,      # HxWx3 uint8 (for overlay)
    ) -> dict:
        """
        Returns:
            heatmap_b64  : base64 JPEG of Grad-CAM overlay
            cam_array    : raw normalised CAM (H,W) float32 in [0,1]
        """
        with self._lock:
            if self.model is None:
                return self._demo_heatmap(original)
    
            # ── forward pass ────────────────────────────────────
            self.model.zero_grad()
            output = self.model(tensor)              # (1, 5)
    
            # ── backward for target class ────────────────────────
            one_hot = torch.zeros_like(output)
            if output.shape[1] == 1:
                one_hot[0, 0] = 1.0
            else:
                idx = min(max(class_idx, 0), output.shape[1] - 1)
                one_hot[0, idx] = 1.0
            output.backward(gradient=one_hot, retain_graph=True)
    
            # ── compute CAM ─────────────────────────────────────
            grads = self._grads          # (1, C, H, W)
            acts  = self._acts           # (1, C, H, W)
    
            # Global average pool gradients → importance weights
            weights = grads.mean(dim=[2, 3], keepdim=True)   # (1, C, 1, 1)
            cam     = (weights * acts).sum(dim=1, keepdim=True)  # (1, 1, H, W)
            cam     = torch.relu(cam).squeeze().cpu().detach().numpy()  # (H, W)
    
            # ── normalise & resize to input image size ───────────
            h, w = original.shape[:2]
            cam   = cv2.resize(cam, (w, h))
            cam   = self._normalise(cam)
            
            # ── Mask out non-retinal border pixels ───────────────
            # Suppress Grad-CAM activations outside the fundus circle
            # to prevent heatmap coloring on black borders
            mask = self._retinal_mask(h, w)
            cam = cam * mask
    
            overlay = self._apply_colormap(cam, original)
            b64     = self._to_base64(overlay)
    
            return {
                "heatmap_b64": b64,
                "cam_array":   cam,
            }

    def remove_hooks(self):
        for h in self._hooks:
            h.remove()
        self._hooks = []

    # ── Private ──────────────────────────────────────────────

    def _register_hooks(self):
        """Attach forward + backward hooks to conv_head (last conv layer)."""
        if self.model is None:
            return

        # EfficientNet-B4 last conv: model.conv_head
        target = None
        for name, module in self.model.named_modules():
            if name == "conv_head":
                target = module
                break

        if target is None:
            logger.warning("conv_head not found — trying last Conv2d")
            for module in self.model.modules():
                if isinstance(module, torch.nn.Conv2d):
                    target = module   # fallback: last Conv2d

        if target is None:
            logger.error("No conv layer found for Grad-CAM hooks")
            return

        def fwd_hook(mod, inp, out):
            self._acts = out

        def bwd_hook(mod, gin, gout):
            self._grads = gout[0]

        self._hooks.append(target.register_forward_hook(fwd_hook))
        self._hooks.append(target.register_full_backward_hook(bwd_hook))

    def _normalise(self, cam: np.ndarray) -> np.ndarray:
        """Scale CAM values to [0, 1]."""
        mn, mx = cam.min(), cam.max()
        if mx - mn < 1e-8:
            return np.zeros_like(cam, dtype=np.float32)
        return ((cam - mn) / (mx - mn)).astype(np.float32)

    def _retinal_mask(self, h: int, w: int, scale: float = 0.9) -> np.ndarray:
        """Create a circular mask matching the fundus aperture."""
        cy, cx = h // 2, w // 2
        r = int(min(h, w) * scale / 2)
        Y, X = np.ogrid[:h, :w]
        mask = ((X - cx)**2 + (Y - cy)**2 <= r**2).astype(np.float32)
        return mask

    def _apply_colormap(
        self, cam: np.ndarray, original: np.ndarray, alpha: float = 0.5
    ) -> np.ndarray:
        """
        Overlay JET heatmap on original image.
        Red = high attention, Blue = low attention (TRD 4.4).
        Only applies heatmap where CAM > 0 (skips black borders).
        """
        heatmap = cv2.applyColorMap(
            (cam * 255).astype(np.uint8), cv2.COLORMAP_JET
        )
        heatmap_rgb = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
        # Only blend where cam is active (non-zero) to preserve black borders
        active = (cam > 0.01)[..., np.newaxis]  # (H, W, 1) boolean mask
        overlay = original.copy()
        overlay = np.where(
            active,
            (original * (1 - alpha) + heatmap_rgb * alpha).astype(np.uint8),
            original
        )
        return overlay.astype(np.uint8)

    def _to_base64(self, img: np.ndarray) -> str:
        """Encode numpy RGB image → base64 JPEG string."""
        pil = Image.fromarray(img)
        buf = io.BytesIO()
        pil.save(buf, format="JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    def _demo_heatmap(self, original: np.ndarray) -> dict:
        """
        Fallback when model is not loaded.
        Returns a synthetic heatmap centred on the image.
        """
        logger.info("GradCAM: DEMO MODE — generating synthetic heatmap")
        h, w = original.shape[:2]
        cy, cx = h // 2, w // 2

        # Gaussian blob centred slightly off-centre (simulates lesion area)
        Y, X = np.ogrid[:h, :w]
        cam = np.exp(-((X - cx - 30)**2 + (Y - cy - 20)**2) / (2 * (h//6)**2))
        cam = self._normalise(cam.astype(np.float32))

        overlay = self._apply_colormap(cam, original)
        return {
            "heatmap_b64": self._to_base64(overlay),
            "cam_array":   cam,
        }
