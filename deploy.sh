#!/bin/bash
set -e

echo "=========================================================="
echo "   🚀 [DJI PROD] MEMULAI ZERO-DOWNTIME DEPLOYMENT        "
echo "=========================================================="

# 1. Masuk ke direktori aplikasi
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
echo "📂 Direktori proyek: $PROJECT_DIR"

# 2. Ambil update terbaru dari GitHub
echo "--> [1/4] Mengambil kode terbaru dari git..."
git pull origin main

# 3. Pastikan dependencies up-to-date
echo "--> [2/4] Memeriksa dependencies..."
npm install --prefer-offline --no-audit

# 4. Build Next.js
echo "--> [3/4] Melakukan build Next.js (npm run build)..."
npm run build

# 5. Graceful Zero-Downtime Reload via PM2 Cluster
echo "--> [4/4] Menerapkan Zero-Downtime Reload ke PM2..."
if command -v pm2 &> /dev/null; then
  # Cek apakah aplikasi 'dji' sudah berjalan di PM2
  if pm2 describe dji > /dev/null 2>&1; then
    echo "🔄 Melakukan Graceful Reload (Zero-Downtime)..."
    pm2 reload ecosystem.config.cjs --update-env
  else
    echo "▶️ Memulai aplikasi dji dalam mode Cluster..."
    pm2 start ecosystem.config.cjs
  fi
  pm2 save
  echo "✅ Zero-Downtime Deployment BERHASIL!"
  echo "🌐 Server tetap aktif melayani tablet tanpa jeda 502 Bad Gateway."
else
  echo "⚠️ PM2 tidak terdeteksi di PATH sistem."
  echo "Jalankan manual: pm2 reload ecosystem.config.cjs"
fi

echo "=========================================================="
