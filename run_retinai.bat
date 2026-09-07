@echo off
title RetinAI - Smart India Hackathon 2026 Launcher
color 0B

echo ======================================================================
echo           RetinAI - Clinical Screening System Launcher
echo           Problem Statement: SIH26038 ^| Team PARSU
echo ======================================================================
echo.

set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%dr-screening\backend
set FRONTEND_DIR=%ROOT_DIR%dr-screening\frontend\dr-dashboard
set MODEL_FILE=%ROOT_DIR%dr-screening\models\best_dr_model.pth

:: 1. Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.10 or 3.11 from python.org
    pause
    exit /b 1
)
echo [OK] Python detected.

:: 2. Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js 18+ or 20+ from nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js detected.

:: 3. Check Model File
if not exist "%MODEL_FILE%" (
    echo.
    echo [WARNING] Model weights file not found at:
    echo   dr-screening\models\best_dr_model.pth
    echo   ^(The system will run in HEURISTIC CLINICAL FALLBACK MODE until weights are placed there^).
    echo.
) else (
    echo [OK] Deep Learning Model Weights found.
)

:: 4. Check Backend Virtual Environment
if not exist "%BACKEND_DIR%\venv\Scripts\python.exe" (
    echo.
    echo [SETUP] Creating Python virtual environment in %BACKEND_DIR%\venv ...
    cd /d "%BACKEND_DIR%"
    python -m venv venv
    echo [SETUP] Installing Python dependencies ^(this may take a few minutes^)...
    "%BACKEND_DIR%\venv\Scripts\pip.exe" install -r requirements.txt
    if not exist "%BACKEND_DIR%\.env" (
        copy "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" >nul
    )
)

:: 5. Check Frontend node_modules
if not exist "%FRONTEND_DIR%\node_modules" (
    echo.
    echo [SETUP] Installing Frontend dependencies in %FRONTEND_DIR% ...
    cd /d "%FRONTEND_DIR%"
    call npm install
)

echo.
echo ======================================================================
echo   Starting RetinAI Backend (Port 8000) and Frontend (Port 5173)...
echo ======================================================================
echo.

:: 6. Launch Backend in new window
start "RetinAI Backend API (Port 8000)" cmd /k "cd /d %BACKEND_DIR% && venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"

:: Wait 3 seconds for backend to initialize
timeout /t 3 /nobreak >nul

:: 7. Launch Frontend in new window
start "RetinAI Frontend UI (Port 5173)" cmd /k "cd /d %FRONTEND_DIR% && npm run dev"

:: Wait 2 seconds and open browser
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo RetinAI is now running!
echo • Frontend UI : http://localhost:5173
echo • Backend API : http://localhost:8000/docs
echo.
echo Leave the two command windows open while testing.
pause
