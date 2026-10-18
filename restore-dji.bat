@echo off
title Restore Database DJI (VPS Supabase)
cd /d "%~dp0"
echo ===============================================================
echo        RESTORE DATA PRODUKSI DJI KE DATABASE
echo ===============================================================
echo.
node scripts/restore-dji-database.mjs
echo.
echo ===============================================================
echo Proses selesai. Tekan sembarang tombol untuk keluar.
echo ===============================================================
pause
