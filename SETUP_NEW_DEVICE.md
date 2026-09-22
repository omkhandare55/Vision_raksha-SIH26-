# 🚀 Running RetinAI on a New Device (Quick Setup Guide)

This guide explains how to set up and run the entire RetinAI system on another laptop or PC.

---

## 📌 1. Prerequisites Needed on the New Device
Make sure the new device has:
1. **Python 3.10 or 3.11** installed ([python.org](https://www.python.org/downloads/)) — *(Check: "Add Python to PATH" during installation)*.
2. **Node.js 18+ or 20+** installed ([nodejs.org](https://nodejs.org/)).
3. **Git** installed ([git-scm.com](https://git-scm.com/)).

---

## 📦 2. Why Some Files Are Missing After `git clone`

Because GitHub limits individual files to **100 MB**, certain large or local-only files are excluded from Git via `.gitignore`:

| Missing Item | Why It's Missing | How to Fix It on the New Device |
| :--- | :--- | :--- |
| **`best_dr_model.pth`** (~109 MB) | Exceeds GitHub's 100 MB upload limit | **Copy it via Pen Drive / Google Drive** into `dr-screening/models/` *(or backend will run in rule-based clinical fallback mode)*. |
| **`venv/`** (Python Virtual Env) | OS-specific binary packages | Run `pip install -r requirements.txt` (see Step 3 below). |
| **`node_modules/`** (Frontend) | Standard npm dependencies | Run `npm install` (see Step 4 below). |
| **`retinai.db`** (SQLite DB) | Database file | **Auto-created automatically** by FastAPI on first launch. |
| **`.env`** (Secret Config) | Sensitive credentials | Copy `.env.example` to `.env` (defaults work out of the box). |

---

## ⚡ 3. One-Time Setup on New Device

Open PowerShell or Command Prompt inside the cloned `SIH26` folder:

### Step A: Model Weights
Copy `best_dr_model.pth` from your current PC into:
```
SIH26\dr-screening\models\best_dr_model.pth
```
*(Note: If you don't copy the weights, RetinAI will still start and run using **Rule-Based Clinical Feature Scoring**).*

### Step B: Backend Setup
```powershell
cd dr-screening\backend

# 1. Create Virtual Environment
python -m venv venv

# 2. Activate Virtual Environment
.\venv\Scripts\activate

# 3. Install Python Dependencies
pip install -r requirements.txt

# 4. Copy Environment File
copy .env.example .env
```

### Step C: Frontend Setup
Open a second terminal window:
```powershell
cd dr-screening\frontend\dr-dashboard

# Install Node Packages
npm install
```

---

## 🚀 4. Starting the Application

### Start Backend (Terminal 1):
```powershell
cd dr-screening\backend
.\venv\Scripts\activate
uvicorn main:app --reload --port 8000
```
> Backend runs at: `http://localhost:8000` (API Docs: `http://localhost:8000/docs`)

### Start Frontend (Terminal 2):
```powershell
cd dr-screening\frontend\dr-dashboard
npm run dev
```
> Frontend runs at: `http://localhost:5173`

---

## 💡 5. One-Click Launcher (`run_retinai.bat`)
You can simply double-click the **`run_retinai.bat`** file located in the root of the project. It will automatically check dependencies and launch both backend and frontend servers!
