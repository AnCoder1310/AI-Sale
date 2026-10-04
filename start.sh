#!/bin/bash
# Script khởi chạy toàn bộ hệ thống VinFast AI Sales Enablement (Backend + Frontend)

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  VINFAST AI SALES ENABLEMENT — SYSTEM STARTUP"
echo "=========================================================="

# 1. Kiểm tra Backend (Port 8000)
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "[✓] Backend đã đang chạy tại http://127.0.0.1:8000"
else
    echo "[i] Đang khởi chạy Backend FastAPI trên port 8000..."
    if [ -d ".venv" ]; then
        source .venv/bin/activate
    fi
    python3 -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    echo "[✓] Backend PID: $BACKEND_PID"
    trap "kill $BACKEND_PID 2>/dev/null" EXIT
    sleep 2
fi

# 2. Khởi chạy Frontend Vite
echo "[i] Đang khởi chạy Frontend Vite..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "[i] Cài đặt dependencies frontend..."
    npm install
fi

echo "[✓] Frontend sẵn sàng. Khởi động máy chủ dev..."
npm run dev
