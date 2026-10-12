#!/usr/bin/env bash
# ==============================================================================
# Script tự động cập nhật code lên Server webdeploy (100.122.190.92)
# Sử dụng:
#   ./scripts/deploy_to_server.sh          -> Cập nhật toàn bộ (backend + frontend)
#   ./scripts/deploy_to_server.sh backend  -> Chỉ cập nhật và rebuild backend
#   ./scripts/deploy_to_server.sh frontend -> Chỉ cập nhật và rebuild frontend
# ==============================================================================

set -e

SERVICE=${1:-""}
REMOTE_HOST="webdeploy"
REMOTE_DIR="/home/admin/aisale"

echo "🚀 [1/3] Đang đồng bộ mã nguồn lên server ($REMOTE_HOST)..."
rsync -avz \
  --exclude '.git' \
  --exclude '.venv' \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude '__pycache__' \
  --exclude '.pytest_cache' \
  --exclude '.ruff_cache' \
  --exclude 'data/app.db' \
  --exclude 'data/chroma' \
  /Users/truongan/P-043-deployment/ "$REMOTE_HOST:$REMOTE_DIR/"

echo "📦 [2/3] Đang tiến hành rebuild container trên server..."
if [ -n "$SERVICE" ]; then
  echo "Rebuilding dịch vụ: $SERVICE"
  ssh "$REMOTE_HOST" "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml up --build -d $SERVICE"
else
  echo "Rebuilding toàn bộ stack..."
  ssh "$REMOTE_HOST" "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml up --build -d"
fi

echo "🩺 [3/3] Kiểm tra trạng thái dịch vụ..."
ssh "$REMOTE_HOST" "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml ps"

echo "-------------------------------------------------------"
echo "✅ CẬP NHẬT HOÀN TẤT!"
echo "🔗 Backend API: https://api-aisale.itup.io.vn/health"
echo "🔗 Frontend Web: https://aisale.itup.io.vn"
echo "-------------------------------------------------------"
