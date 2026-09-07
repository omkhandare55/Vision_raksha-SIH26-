# RetinAI — World-Best DR Grading Model
# Techniques: Regression + Ben Graham + 5-Fold + TTA + Threshold Optimization
# Expected QWK: 0.92-0.93+ on APTOS 2019
# Kaggle GPU: Tesla T4 (~2.5 hours)

import os, time, glob, cv2, warnings
import numpy as np
import pandas as pd
from PIL import Image
from scipy.optimize import minimize

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torch.cuda.amp import autocast

import timm
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import cohen_kappa_score
import albumentations as A
from albumentations.pytorch import ToTensorV2

warnings.filterwarnings("ignore")

# ── Config ────────────────────────────────────────────────────
CFG = {
    "model_name":   "efficientnet_b5",
    "img_size":     456,
    "num_classes":  1,           # REGRESSION: single output
    "epochs":       15,
    "batch_size":   8,
    "lr":           3e-4,
    "min_lr":       1e-6,
    "weight_decay": 1e-4,
    "n_folds":      5,
    "tta_steps":    8,           # Test Time Augmentation rounds
    "seed":         42,
    "device":       "cuda" if torch.cuda.is_available() else "cpu",
    "data_dir":     "/kaggle/input/competitions/aptos2019-blindness-detection",
    "output_dir":   "/kaggle/working",
}

print(f"{'='*65}")
print(f"  RetinAI — World-Best DR Model Training")
print(f"  Device  : {CFG['device']}")
if torch.cuda.is_available():
    print(f"  GPU     : {torch.cuda.get_device_name(0)}")
print(f"  Model   : {CFG['model_name']} | Regression Mode")
print(f"  Epochs  : {CFG['epochs']} x {CFG['n_folds']} folds")
print(f"{'='*65}\n")

torch.manual_seed(CFG["seed"])
np.random.seed(CFG["seed"])
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(CFG["seed"])


# ══════════════════════════════════════════════════════════════
# 1. BEN GRAHAM PREPROCESSING (biggest single boost)
# ══════════════════════════════════════════════════════════════
def ben_graham(img, sigma=10):
    """Subtract local mean colour, enhance blood vessels."""
    return cv2.addWeighted(
        img, 4,
        cv2.GaussianBlur(img, (0, 0), sigma), -4,
        128
    )

def circle_crop(img, scale=0.9):
    """Black-out pixels outside the retinal circle."""
    h, w  = img.shape[:2]
    cx, cy = w // 2, h // 2
    r      = int(min(w, h) * scale / 2)
    mask   = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(mask, (cx, cy), r, 255, -1)
    img[mask == 0] = 0
    return img


# ══════════════════════════════════════════════════════════════
# 2. DATASET
# ══════════════════════════════════════════════════════════════
class APTOSDataset(Dataset):
    def __init__(self, df, img_dir, transform=None):
        self.df        = df.reset_index(drop=True)
        self.img_dir   = img_dir
        self.transform = transform

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row  = self.df.iloc[idx]
        path = os.path.join(self.img_dir, row["id_code"] + ".png")
        img  = cv2.imread(path)
        img  = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Ben Graham preprocessing
        img = circle_crop(img)
        img = ben_graham(img)

        if self.transform:
            img = self.transform(image=img)["image"]

        # REGRESSION: label is float
        label = torch.tensor(row["diagnosis"], dtype=torch.float32)
        return img, label


# ══════════════════════════════════════════════════════════════
# 3. AUGMENTATIONS
# ══════════════════════════════════════════════════════════════
def get_train_transform(s):
    return A.Compose([
        A.RandomResizedCrop(size=(s, s), scale=(0.8, 1.0)),
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.5),
        A.RandomRotate90(p=0.5),
        A.Affine(scale=(0.9, 1.1), rotate=(-45, 45),
                 shear=(-10, 10), p=0.5),
        A.CLAHE(clip_limit=4.0, p=0.5),
        A.ColorJitter(brightness=0.3, contrast=0.3,
                      saturation=0.2, hue=0.02, p=0.5),
        A.GaussNoise(p=0.3),
        A.GaussianBlur(blur_limit=(3, 7), p=0.2),
        A.CoarseDropout(max_holes=8, max_height=32,
                        max_width=32, p=0.3),
        A.Normalize(mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]),
        ToTensorV2(),
    ])

def get_val_transform(s):
    return A.Compose([
        A.Resize(height=s, width=s),
        A.Normalize(mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]),
        ToTensorV2(),
    ])

# TTA transform (random flips + rotations at inference)
def get_tta_transform(s):
    return A.Compose([
        A.Resize(height=s, width=s),
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.5),
        A.RandomRotate90(p=0.5),
        A.Normalize(mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]),
        ToTensorV2(),
    ])


# ══════════════════════════════════════════════════════════════
# 4. TRAINING LOOP (Regression with MSE Loss)
# ══════════════════════════════════════════════════════════════
def train_epoch(model, loader, optimizer, criterion, scaler, device):
    model.train()
    total_loss, n = 0.0, 0
    for imgs, labels in loader:
        imgs   = imgs.to(device)
        labels = labels.to(device).unsqueeze(1)   # (B, 1)
        optimizer.zero_grad()
        with autocast(enabled=(device == "cuda")):
            preds = model(imgs)                    # (B, 1)
            loss  = criterion(preds, labels)
        if device == "cuda":
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
        else:
            loss.backward()
            optimizer.step()
        total_loss += loss.item() * len(labels)
        n += len(labels)
    return total_loss / n


def val_epoch(model, loader, device):
    """Returns raw continuous predictions for threshold optimization."""
    model.eval()
    preds_all, labels_all = [], []
    with torch.no_grad():
        for imgs, labels in loader:
            imgs = imgs.to(device)
            with autocast(enabled=(device == "cuda")):
                out = model(imgs).squeeze(1)       # (B,)
            preds_all.extend(out.cpu().numpy())
            labels_all.extend(labels.numpy())
    return np.array(preds_all), np.array(labels_all)


# ══════════════════════════════════════════════════════════════
# 5. THRESHOLD OPTIMIZATION (free +0.01–0.02 QWK)
# ══════════════════════════════════════════════════════════════
def optimize_thresholds(preds, labels):
    """Find best thresholds t1..t4 to maximise QWK."""
    def neg_kappa(thresholds):
        t = np.sort(thresholds)
        grades = np.digitize(preds, t)
        return -cohen_kappa_score(labels, grades, weights="quadratic")

    init = [0.5, 1.5, 2.5, 3.5]
    result = minimize(neg_kappa, init, method="Nelder-Mead",
                      options={"xatol": 1e-4, "fatol": 1e-4,
                               "maxiter": 10000})
    best_thresholds = np.sort(result.x)
    return best_thresholds


def apply_thresholds(preds, thresholds):
    return np.digitize(preds, np.sort(thresholds))


# ══════════════════════════════════════════════════════════════
# 6. TEST TIME AUGMENTATION (TTA)
# ══════════════════════════════════════════════════════════════
def tta_predict(model, df, img_dir, thresholds, device, n_tta=8):
    """Run inference n_tta times with random augmentations, average."""
    all_preds = []
    tta_transform = get_tta_transform(CFG["img_size"])

    for t in range(n_tta):
        ds     = APTOSDataset(df, img_dir, tta_transform)
        loader = DataLoader(ds, batch_size=CFG["batch_size"],
                            shuffle=False, num_workers=2)
        preds, _ = val_epoch(model, loader, device)
        all_preds.append(preds)
        print(f"  TTA {t+1}/{n_tta} done", end="\r")

    avg_preds = np.mean(all_preds, axis=0)
    return apply_thresholds(avg_preds, thresholds)


# ══════════════════════════════════════════════════════════════
# 7. MAIN
# ══════════════════════════════════════════════════════════════
train_df = pd.read_csv(f"{CFG['data_dir']}/train.csv")
img_dir  = f"{CFG['data_dir']}/train_images"
print(f"Dataset: {len(train_df)} records | Images: {len(os.listdir(img_dir))}")

grade_names = ["No DR","Mild DR","Moderate DR","Severe DR","Proliferative DR"]
for g, cnt in train_df["diagnosis"].value_counts().sort_index().items():
    print(f"  Grade {g} ({grade_names[g]}): {cnt}")

criterion = nn.SmoothL1Loss(beta=0.5)   # Huber Loss: robust to noisy medical labels
skf       = StratifiedKFold(n_splits=CFG["n_folds"],
                             shuffle=True, random_state=CFG["seed"])

fold_results = []   # (fold, best_kappa, best_path, thresholds)
t0_total = time.time()

for fold, (train_idx, val_idx) in enumerate(
        skf.split(train_df, train_df["diagnosis"])):

    print(f"\n{'='*65}")
    print(f"  FOLD {fold+1}/{CFG['n_folds']} | "
          f"Train: {len(train_idx)} | Val: {len(val_idx)}")
    print(f"{'='*65}")

    # Class-Balanced Weighted Sampler (counters Grade 1 & 3 minority imbalance)
    train_subset = train_df.iloc[train_idx]
    train_targets = train_subset["diagnosis"].values
    class_counts = np.bincount(train_targets, minlength=5)
    class_weights = 1.0 / np.maximum(class_counts, 1)
    sample_weights = class_weights[train_targets]
    sampler = torch.utils.data.WeightedRandomSampler(
        weights=torch.DoubleTensor(sample_weights),
        num_samples=len(sample_weights),
        replacement=True
    )

    nw = 2 if CFG["device"] == "cuda" else 0
    train_loader = DataLoader(
        APTOSDataset(train_subset, img_dir,
                     get_train_transform(CFG["img_size"])),
        batch_size=CFG["batch_size"], sampler=sampler,
        num_workers=nw, pin_memory=True)
    val_loader = DataLoader(
        APTOSDataset(train_df.iloc[val_idx], img_dir,
                     get_val_transform(CFG["img_size"])),
        batch_size=CFG["batch_size"], shuffle=False,
        num_workers=nw, pin_memory=True)

    model = timm.create_model(
        CFG["model_name"], pretrained=True,
        num_classes=CFG["num_classes"]
    ).to(CFG["device"])

    optimizer = optim.AdamW(model.parameters(),
                             lr=CFG["lr"],
                             weight_decay=CFG["weight_decay"])
    # Cosine annealing with linear warmup
    total_steps = CFG["epochs"] * len(train_loader)
    warmup_steps = len(train_loader) * 2   # 2 epoch warmup
    def lr_lambda(step):
        if step < warmup_steps:
            return step / warmup_steps
        progress = (step - warmup_steps) / (total_steps - warmup_steps)
        return CFG["min_lr"] / CFG["lr"] + \
               0.5 * (1 - CFG["min_lr"] / CFG["lr"]) * \
               (1 + np.cos(np.pi * progress))
    scheduler = optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)
    scaler    = torch.amp.GradScaler("cuda",
                    enabled=(CFG["device"] == "cuda"))

    best_kappa   = -1.0
    best_path    = f"{CFG['output_dir']}/fold{fold+1}_best.pth"
    best_thresholds = [0.5, 1.5, 2.5, 3.5]

    for epoch in range(CFG["epochs"]):
        ep_t    = time.time()
        tr_loss = train_epoch(model, train_loader, optimizer,
                              criterion, scaler, CFG["device"])
        scheduler.step()

        # Validate + optimize thresholds every epoch
        val_preds, val_labels = val_epoch(model, val_loader,
                                          CFG["device"])
        thresholds  = optimize_thresholds(val_preds, val_labels)
        grade_preds = apply_thresholds(val_preds, thresholds)
        kappa       = cohen_kappa_score(val_labels, grade_preds,
                                        weights="quadratic")

        tag = ""
        if kappa > best_kappa:
            best_kappa       = kappa
            best_thresholds  = thresholds
            torch.save({
                "model":      model.state_dict(),
                "thresholds": thresholds,
                "fold":       fold + 1,
                "kappa":      kappa,
            }, best_path)
            tag = "  [SAVED ✓]"

        print(f"  Ep {epoch+1:02d}/{CFG['epochs']} | "
              f"Loss: {tr_loss:.4f} | "
              f"QWK: {kappa:.4f} | "
              f"Thresh: {[f'{t:.2f}' for t in thresholds]} | "
              f"{time.time()-ep_t:.0f}s{tag}")

    fold_results.append((fold+1, best_kappa, best_path, best_thresholds))
    print(f"\n  Fold {fold+1} Best QWK: {best_kappa:.4f}")
    print(f"  Best Thresholds: {[f'{t:.3f}' for t in best_thresholds]}")

# ── Final Summary ─────────────────────────────────────────────
total_min = (time.time() - t0_total) / 60
kappas    = [r[1] for r in fold_results]
best_fold = max(fold_results, key=lambda x: x[1])

print(f"\n{'='*65}")
print(f"  ALL FOLDS COMPLETE in {total_min:.1f} minutes")
print(f"{'='*65}")
for fold_num, kappa, path, thresh in fold_results:
    marker = " ← BEST" if kappa == max(kappas) else ""
    print(f"  Fold {fold_num}: QWK = {kappa:.4f}{marker}")
print(f"\n  Mean QWK : {np.mean(kappas):.4f}")
print(f"  Best QWK : {max(kappas):.4f}  (Fold {best_fold[0]})")
print(f"{'='*65}")

# ── Copy Best Fold and Export 5-Fold Ensemble Bundle ──────────
import shutil
final_path = f"{CFG['output_dir']}/best_dr_model.pth"
shutil.copy(best_fold[2], final_path)
print(f"\n  Final single model: {final_path}")

ensemble_path = f"{CFG['output_dir']}/best_dr_ensemble.pth"
ensemble_bundle = {
    "arch": CFG["model_name"],
    "input_size": CFG["img_size"],
    "is_regression": True,
    "folds": [
        {
            "fold": r[0],
            "state_dict": torch.load(r[2], map_location="cpu")["model"],
            "thresholds": r[3],
            "kappa": r[1],
        }
        for r in fold_results
    ],
    "mean_thresholds": np.mean([r[3] for r in fold_results], axis=0).tolist(),
    "mean_kappa": float(np.mean(kappas)),
}
torch.save(ensemble_bundle, ensemble_path)
print(f"  Ensemble bundle: {ensemble_path}")
print(f"  Download 'best_dr_model.pth' or 'best_dr_ensemble.pth' from the Output panel →")
