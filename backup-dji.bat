@echo off
title Backup Database DJI (VPS Supabase)
cd /d "%~dp0"
echo ===============================================================
echo        MEMULAI BACKUP DATA PRODUKSI DJI DARI VPS
echo ===============================================================
echo.
node scripts/backup-dji-database.mjs
echo.
echo ===============================================================
echo Backup selesai. Tekan sembarang tombol untuk keluar.
echo ===============================================================
pause
