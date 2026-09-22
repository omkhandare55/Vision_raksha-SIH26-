#!/usr/bin/env bash
# Render Build Script
# This script builds both the frontend (Vite React) and backend (FastAPI) on Render.

set -e

echo "=== 1. Building Frontend ==="
# Move to the frontend directory
cd ../frontend/dr-dashboard

# Install Node dependencies
echo "Installing npm dependencies..."
npm install

# Build the React app
echo "Building the React frontend..."
npm run build

echo "Frontend build complete. Dist folder is ready."

# Move back to backend directory
cd ../../backend

echo "=== 2. Building Backend ==="
# Install Python dependencies
echo "Installing pip dependencies..."
pip install -r requirements.txt

echo "=== Build Successful! ==="
