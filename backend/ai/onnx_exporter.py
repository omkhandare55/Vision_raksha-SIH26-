# backend/ai/onnx_exporter.py
# ONNX Model Exporter for Edge AI Deployment
# Converts PyTorch EfficientNet model to ONNX for 5x–10x faster edge inference

import os
import torch
import timm
import logging

logger = logging.getLogger(__name__)


def export_to_onnx(
    model_path: str = "models/best_dr_model.pth",
    output_onnx_path: str = "models/best_dr_model.onnx",
    input_size: int = 456,
) -> str:
    """
    Exports PyTorch model checkpoint to ONNX format.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")

    device = "cpu"
    state  = torch.load(model_path, map_location=device)

    if isinstance(state, dict) and "model" in state:
        state = state["model"]

    # Detect arch & num_classes
    arch = "efficientnet_b5" if state["classifier.weight"].shape[1] == 2048 else "efficientnet_b4"
    num_classes = state["classifier.weight"].shape[0]

    model = timm.create_model(arch, pretrained=False, num_classes=num_classes)
    model.load_state_dict(state)
    model.eval()

    # Dummy input (batch=1, ch=3, H, W)
    dummy_input = torch.randn(1, 3, input_size, input_size, device=device)

    os.makedirs(os.path.dirname(output_onnx_path), exist_ok=True)

    torch.onnx.export(
        model,
        dummy_input,
        output_onnx_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}},
    )

    size_mb = os.path.getsize(output_onnx_path) / 1024 / 1024
    print(f"✅ ONNX model successfully exported: {output_onnx_path} ({size_mb:.1f} MB)")
    return output_onnx_path


if __name__ == "__main__":
    export_to_onnx()
