# notebooks/train_dr_model.py
# RetinAI — EfficientNet-B4 Training Script for Kaggle (GPU)
# Features: Mixed Precision (AMP), Cosine Annealing, Class-Weighted Loss, Quadratic Weighted Kappa
# Est. Training Time on Kaggle P100 / T4: ~30-45 minutes

import os
import gc
import time
import glob
import numpy as np
import pandas as pd
from pathlib import Path
from PIL import Image

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torch.cuda.amp import autocast, GradScaler

import timm
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import cohen_kappa_score, classification_report
import albumentations as A
from albumentations.pytorch import ToTensorV2

# ── Config ────────────────────────────────────────────────────
CFG = {
    "model_name":   "efficientnet_b4",
    "img_size":     380,
    "num_classes":  5,
    "epochs":       12,
    "batch_size":   16,
    "lr":           3e-4,
    "min_lr":       1e-6,
    "weight_decay": 1e-4,
    "seed":         42,
    "device":       "cuda" if torch.cuda.is_available() else "cpu",
    "output_dir":   "/kaggle/working",
}

print(f"{'='*60}")
print(f"  RetinAI — DR Model Training (Kaggle GPU)")
print(f"  Device : {CFG['device']}")
if torch.cuda.is_available():
    print(f"  GPU    : {torch.cuda.get_device_name(0)}")
print(f"  Model  : {CFG['model_name']} (Image Size: {CFG['img_size']}x{CFG['img_size']})")
print(f"  Epochs : {CFG['epochs']} | Batch Size: {CFG['batch_size']}")
print(f"{'='*60}\n")

# ── Seed ─────────────────────────────────────────────────────
torch.manual_seed(CFG["seed"])
np.random.seed(CFG["seed"])
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(CFG["seed"])

# ── Auto-Detect Dataset Location on Kaggle ───────────────────
possible_dirs = [
    "/kaggle/input/aptos2019-blindness-detection",
    "/kaggle/input/competitions/aptos2019-blindness-detection",
    os.path.expanduser("~/.cache/kagglehub/competitions/aptos2019-blindness-detection"),
]

DATA_DIR = None
for p in possible_dirs:
    if os.path.exists(p):
        for root, dirs, files in os.walk(p):
            if "train.csv" in files:
                DATA_DIR = root
                break
    if DATA_DIR:
        break

if not DATA_DIR:
    DATA_DIR = "/kaggle/input/aptos2019-blindness-detection"

print(f"Dataset root detected: {DATA_DIR}")

# ── Dataset Definition ────────────────────────────────────────
class APTOSDataset(Dataset):
    def __init__(self, df, image_map, transform=None):
        self.df = df.reset_index(drop=True)
        self.image_map = image_map
        self.transform = transform

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        img_id = row["id_code"]
        path = self.image_map[img_id]

        img = np.array(Image.open(path).convert("RGB"))

        if self.transform:
            augmented = self.transform(image=img)
            img = augmented["image"]

        label = int(row["diagnosis"])
        return img, label

# ── Augmentations ─────────────────────────────────────────────
def get_train_transform(img_size):
    return A.Compose([
        A.RandomResizedCrop(size=(img_size, img_size), scale=(0.8, 1.0)),
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.5),
        A.RandomRotate90(p=0.5),
        A.ShiftScaleRotate(shift_limit=0.05, scale_limit=0.1, rotate_limit=30, p=0.5),
        A.CLAHE(clip_limit=2.0, p=0.4),
        A.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1, p=0.4),
        A.GaussNoise(p=0.2),
        A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ToTensorV2(),
    ])

def get_val_transform(img_size):
    return A.Compose([
        A.Resize(height=img_size, width=img_size),
        A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ToTensorV2(),
    ])

# ── Training & Validation Step with AMP ────────────────────────
def train_epoch(model, loader, optimizer, criterion, scaler, device):
    model.train()
    total_loss, total_samples = 0.0, 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(device), labels.to(device)
        optimizer.zero_grad()

        with autocast(enabled=(device == "cuda")):
            outputs = model(imgs)
            loss = criterion(outputs, labels)

        if device == "cuda":
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
        else:
            loss.backward()
            optimizer.step()

        total_loss += loss.item() * len(labels)
        total_samples += len(labels)

    return total_loss / total_samples

def val_epoch(model, loader, criterion, device):
    model.eval()
    total_loss, total_samples = 0.0, 0
    all_preds, all_labels = [], []

    with torch.no_grad():
        for imgs, labels in loader:
            imgs, labels = imgs.to(device), labels.to(device)
            with autocast(enabled=(device == "cuda")):
                outputs = model(imgs)
                loss = criterion(outputs, labels)

            total_loss += loss.item() * len(labels)
            total_samples += len(labels)
            preds = outputs.argmax(dim=1).cpu().numpy()
            all_preds.extend(preds)
            all_labels.extend(labels.cpu().numpy())

    kappa = cohen_kappa_score(all_labels, all_preds, weights="quadratic")
    return total_loss / total_samples, kappa, all_preds, all_labels

# ── Main Routine ──────────────────────────────────────────────
def main():
    train_csv_path = os.path.join(DATA_DIR, "train.csv")
    if not os.path.exists(train_csv_path):
        train_csv_path = glob.glob(f"{DATA_DIR}/**/train.csv", recursive=True)[0]

    train_df = pd.read_csv(train_csv_path)

    # ── Index all images in dataset directory recursively ────────
    print("Indexing dataset images...")
    image_map = {}
    for root, _, files in os.walk(DATA_DIR):
        for f in files:
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                img_name = os.path.splitext(f)[0]
                image_map[img_name] = os.path.join(root, f)

    print(f"Indexed {len(image_map)} images.")
    # Keep only records where the image actually exists
    train_df = train_df[train_df["id_code"].isin(image_map)].reset_index(drop=True)
    print(f"Verified {len(train_df)} training samples with matching image files.")

    print("Class distribution:")
    grade_names = ["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"]
    for g, count in train_df["diagnosis"].value_counts().sort_index().items():
        print(f"  Grade {g} ({grade_names[g]}): {count} images ({count/len(train_df)*100:.1f}%)")

    # Balanced class weights
    counts = train_df["diagnosis"].value_counts().sort_index().values.astype(float)
    weights = torch.tensor(1.0 / counts, dtype=torch.float)
    weights = (weights / weights.sum()) * len(counts)
    weights = weights.to(CFG["device"])
    criterion = nn.CrossEntropyLoss(weight=weights)

    # Stratified Split (80% Train / 20% Val)
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=CFG["seed"])
    train_idx, val_idx = next(iter(skf.split(train_df, train_df["diagnosis"])))

    print(f"\nTraining set: {len(train_idx)} | Validation set: {len(val_idx)}")

    train_ds = APTOSDataset(train_df.iloc[train_idx], image_map, get_train_transform(CFG["img_size"]))
    val_ds   = APTOSDataset(train_df.iloc[val_idx],   image_map, get_val_transform(CFG["img_size"]))

    num_workers = 2 if CFG["device"] == "cuda" else 0
    train_loader = DataLoader(train_ds, batch_size=CFG["batch_size"], shuffle=True,  num_workers=num_workers, pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=CFG["batch_size"], shuffle=False, num_workers=num_workers, pin_memory=True)

    # Build Model
    print(f"\nBuilding {CFG['model_name']} pretrained on ImageNet...")
    model = timm.create_model(CFG["model_name"], pretrained=True, num_classes=CFG["num_classes"])
    model = model.to(CFG["device"])

    optimizer = optim.AdamW(model.parameters(), lr=CFG["lr"], weight_decay=CFG["weight_decay"])
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=CFG["epochs"], eta_min=CFG["min_lr"])
    scaler = torch.amp.GradScaler("cuda", enabled=(CFG["device"] == "cuda"))

    best_kappa = -1.0
    best_model_path = os.path.join(CFG["output_dir"], "best_dr_model.pth")
    start_time = time.time()

    print("\nStarting Training...\n" + "-"*70)

    for epoch in range(CFG["epochs"]):
        ep_start = time.time()

        train_loss = train_epoch(model, train_loader, optimizer, criterion, scaler, CFG["device"])
        val_loss, kappa, preds, labels = val_epoch(model, val_loader, criterion, CFG["device"])
        scheduler.step()

        ep_duration = time.time() - ep_start
        saved_tag = ""

        if kappa > best_kappa:
            best_kappa = kappa
            torch.save(model.state_dict(), best_model_path)
            saved_tag = "  --> [SAVED NEW BEST MODEL]"

        print(f"Epoch [{epoch+1:02d}/{CFG['epochs']:02d}] "
              f"| Train Loss: {train_loss:.4f} "
              f"| Val Loss: {val_loss:.4f} "
              f"| QWK (Kappa): {kappa:.4f} "
              f"| Time: {ep_duration:.1f}s{saved_tag}")

    total_min = (time.time() - start_time) / 60
    print("\n" + "="*70)
    print(f"  Training Finished in {total_min:.1f} minutes")
    print(f"  Best Quadratic Weighted Kappa: {best_kappa:.4f}")
    print(f"  Saved Weights: {best_model_path}")
    print("="*70)

    # Classification Report on Best Model
    model.load_state_dict(torch.load(best_model_path, map_location=CFG["device"]))
    _, final_kappa, final_preds, final_labels = val_epoch(model, val_loader, criterion, CFG["device"])
    print("\nFinal Validation Classification Report:")
    print(classification_report(final_labels, final_preds, target_names=grade_names, digits=4))

if __name__ == "__main__":
    main()
