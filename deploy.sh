#!/bin/bash
set -e

echo "=========================================================="
echo "   🚀 [DJI PROD] MEMULAI DEPLOYMENT                       "
echo "=========================================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
echo "📂 Direktori proyek: $PROJECT_DIR"

echo "--> [1/3] Mengambil kode terbaru dari git..."
git pull origin main

echo "--> [2/3] Membangun Next.js produksi (npm run build)..."
npm run build

echo "--> [3/3] Merestart PM2..."
pm2 restart all || pm2 start npm --name "dji" -- start
pm2 save

echo "=========================================================="
echo "   ✅ DEPLOYMENT BERHASIL! Server kembali ONLINE.         "
echo "=========================================================="
pm2 status
