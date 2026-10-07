# ⏰ Panduan Konfigurasi Native Server Cron di VPS Ubuntu

Panduan ini digunakan untuk menjalankan sinkronisasi otomatis Google Sheets secara langsung di server VPS menggunakan **Linux Crontab**, sehingga sinkronisasi tetap berjalan terjadwal meskipun **tidak ada browser/laptop yang sedang membuka aplikasi**.

---

## 1. Tambahkan `CRON_SECRET` di File Environment VPS

Buka file environment di server VPS Anda (misalnya `.env.local` atau `.env.prod`):

```bash
# Tambahkan token rahasia acak (misal kombinasi 32 karakter)
CRON_SECRET=dji_secure_cron_token_2026_xyz88!
```

Setelah mengubah `.env`, restart aplikasi Next.js:
```bash
pm2 restart all
```

---

## 2. Pasang Jadwal di Linux Crontab

Buka editor crontab di VPS:
```bash
crontab -e
```

Tambahkan baris-baris berikut di baris paling bawah.
*(Catatan: Waktu server VPS umumnya UTC. WIB = UTC + 7, jadi kurangi 7 jam)*

```cron
# ------------------------------------------------------------------------------------
# JADWAL SINKRONISASI GOOGLE SHEETS DJI (WIB = UTC + 7)
# ------------------------------------------------------------------------------------

# 1. Sinkronisasi Laporan Bulanan Mesin (Pukul 09:00 WIB / 02:00 UTC)
0 2 * * * curl -s -X POST "http://localhost:3000/api/cron/sync-monthly-machine" -H "Authorization: Bearer dji_secure_cron_token_2026_xyz88!" > /dev/null 2>&1

# 2. Sinkronisasi Laporan Potong Kain (Pukul 17:00 WIB / 10:00 UTC)
0 10 * * * curl -s -X POST "http://localhost:3000/api/cron/sync-potong-kain" -H "Authorization: Bearer dji_secure_cron_token_2026_xyz88!" > /dev/null 2>&1

# 3. Sinkronisasi Laporan Harian Inspect & Mending (Pukul 17:30 WIB / 10:30 UTC)
30 10 * * * curl -s -X POST "http://localhost:3000/api/cron/sync-daily-inspect-mending" -H "Authorization: Bearer dji_secure_cron_token_2026_xyz88!" > /dev/null 2>&1
```

Simpan dan keluar (di nano tekan `Ctrl + O`, `Enter`, lalu `Ctrl + X`).

---

## 3. Uji Coba Manual via Terminal VPS

Anda dapat menguji apakah endpoint cron berjalan sukses dengan perintah `curl`:

```bash
curl -i -X POST "http://localhost:3000/api/cron/sync-monthly-machine" \
  -H "Authorization: Bearer dji_secure_cron_token_2026_xyz88!"
```

Jika berhasil, Anda akan menerima respon HTTP `200 OK` dengan payload JSON konfirmasi data berhasil disinkronkan.
