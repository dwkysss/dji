# Panduan & Naskah Penyuluhan Operator V2: Input Produksi & Cacat Kain

Dokumen ini disusun khusus sebagai bahan acuan briefing/penyuluhan operator mesin rajut, mencakup **naskah voiceover video tutorial (10 langkah)**, **panduan SOP cetak**, dan **FAQ lapangan**.

---

## 1. NASKAH VIDEO TUTORIAL RESMI (10 LANGKAH LENGKAP)

File video jadi tersedia di: `public/tutorial_operator.mp4` (atau akses langsung di browser: `http://localhost:3000/tutorial_operator.mp4`).

### Adegan 1: Kedatangan Operator & Login (00:00 - 00:08)
* **Tampilan Visual:** Layar Login Tablet (`/login`).
* **Lower-Third Banner:** `LANGKAH 1: KEDATANGAN & LOGIN` | *Masuk Menggunakan Akun Operator*
* **Narasi Suara:**
  > *"Saat tiba di mesin yang akan Anda operasikan, buka tablet. Jika diperlukan login, masuk menggunakan akun Anda yang sudah terdaftar."*

---

### Adegan 2: Pemilihan Mode Mesin (00:08 - 00:18)
* **Tampilan Visual:** Bagian atas formulir input (`/input?mode=panel`) menyorot toggle `PANEL` dan `METER`.
* **Lower-Third Banner:** `LANGKAH 2: MODE MESIN` | *Pilih Mode Panel atau Mode All Over (Meter)*
* **Narasi Suara:**
  > *"Setelah masuk, Anda langsung diarahkan ke form input produksi. Terdapat dua mode: mode Panel untuk jenis panel, dan mode Meter untuk kain all over."*

---

### Adegan 3: Ubah Header - Tim & Nama Operator (00:18 - 00:27)
* **Tampilan Visual:** Mengklik tombol **"Ubah Header"**, popup modal muncul menyorot pilihan Grup/Tim dan daftar Nama Operator.
* **Lower-Third Banner:** `LANGKAH 3: UBAH HEADER` | *Pilih Tim (Grup) dan Nama Operator*
* **Narasi Suara:**
  > *"Sebelum mulai, ubah data header dengan klik tombol Ubah Header. Pilih Tim kerja Anda terlebih dahulu, lalu pilih nama Anda dari daftar operator."*

---

### Adegan 4: Kartu Potong, Course & RPM Real-Time (00:27 - 00:37)
* **Tampilan Visual:** Bagian parameter kartu potong di dalam modal, menyorot field **Course** dan **RPM**, lalu tombol **"Simpan Konfigurasi"**.
* **Lower-Third Banner:** `LANGKAH 3: SIMPAN KONFIGURASI` | *Course & RPM Real-Time di Mesin*
* **Narasi Suara:**
  > *"Sesuaikan parameter dengan kartu potong. Untuk Course dan RPM, wajib memakai nilai yang tertera secara real-time di mesin, lalu tekan Simpan Konfigurasi."*

---

### Adegan 5: Fitur Blok Mesin / Mesin Mati (00:37 - 00:45)
* **Tampilan Visual:** Menyorot tombol kuning **"Mesin Mati"** di sebelah atas header.
* **Lower-Third Banner:** `LANGKAH 4: FITUR BLOK MESIN` | *Tombol Mesin Mati (Perbaikan Berat / Lintas Shift)*
* **Narasi Suara:**
  > *"Di sebelah header terdapat tombol Mesin Mati. Fitur ini digunakan untuk perbaikan berat atau mesin mati total lintas shift tanpa produksi kain."*

---

### Adegan 6: Info Nomor Panel Shift Lalu & Card Downtime (00:45 - 00:52)
* **Tampilan Visual:** Menyorot Card info Nomor Panel besar di sebelah kiri dan Card Downtime Tracker di sebelah kanan.
* **Lower-Third Banner:** `LANGKAH 5: INFO PANEL & DOWNTIME` | *Melanjutkan Nomor Panel Shift Sebelumnya*
* **Narasi Suara:**
  > *"Di bawah header terdapat info nomor panel yang otomatis melanjutkan shift sebelumnya, serta card downtime otomatis di sebelahnya."*

---

### Adegan 7: Keadaan ESP32 & Counter Timer Otomatis (00:52 - 01:03)
* **Tampilan Visual:** Card Wi-Fi Trigger ESP32 tepat di bawah info nomor panel, memperlihatkan status koneksi dan tombol sambungkan kembali.
* **Lower-Third Banner:** `LANGKAH 6: KONEKSI ESP32` | *Status ESP32 & Counter Timer Otomatis*
* **Narasi Suara:**
  > *"Perhatikan status ESP32 di bawah info panel. Pastikan selalu terhubung agar timer otomatis mencatat saat mesin mati. Jika putus, sambungkan kembali."*

---

### Adegan 8: Modal Masalah Otomatis & Opsi Gagal Cacat (01:03 - 01:13)
* **Tampilan Visual:** Bagian pencatatan kendala / modal masalah saat mesin jalan kembali, serta tombol/opsi **Gagal Cacat**.
* **Lower-Third Banner:** `LANGKAH 7: PENCATATAN KENDALA` | *Modal Masalah Otomatis & Opsi Gagal Cacat*
* **Narasi Suara:**
  > *"Saat mesin jalan kembali setelah berhenti, modal masalah muncul otomatis. Isi kendalanya, dan jika mesin stop tanpa cacat kain, pilih Gagal Cacat."*

---

### Adegan 9: Opsi Potong Kain & Tandai PCS BS (01:13 - 01:21)
* **Tampilan Visual:** Membuka modal **"Potong Kain & BS"**, menyorot toggle Potong Kain dan pilihan PCS 1, PCS 2 BS.
* **Lower-Third Banner:** `LANGKAH 8: POTONG KAIN & BS` | *Lapor Potong Roll & Tandai PCS BS*
* **Narasi Suara:**
  > *"Di bagian bawah, buka opsi Potong Kain jika gulungan kain sudah harus dipotong, dan tandai PCS BS jika ada cacat yang tidak bisa diselamatkan."*

---

### Adegan 10: Status Laporan & Kirim Laporan Panel (01:21 - 01:31)
* **Tampilan Visual:** Pilihan radio button Normal vs Istirahat (menampilkan nama Operator Backup), lalu menyorot tombol biru **"Kirim Laporan Panel"**.
* **Lower-Third Banner:** `LANGKAH 9: STATUS & KIRIM LAPORAN` | *Mode Normal / Istirahat & Kirim Laporan*
* **Narasi Suara:**
  > *"Pastikan jenis laporan Normal untuk kerja biasa. Jika Anda hendak istirahat, pilih Istirahat dan tentukan operator backup. Lalu klik Kirim Laporan Panel."*

---

## 2. LEMBAR RINGKASAN SOP CETAK LAPANGAN

```
================================================================================
           SOP OPERATOR: INPUT PRODUKSI, SENSOR ESP32 & CACAT KAIN
================================================================================

1. LOGIN & CEK MODE
   - Masuk akun di tablet mesin.
   - Pilih mode: PANEL (untuk kain panel) atau METER (untuk all over).

2. UBAH HEADER & PARAMETER REAL-TIME
   - Klik [Ubah Header].
   - Pilih TIM / GRUP -> Pilih NAMA OPERATOR.
   - Sesuaikan parameter kartu potong.
   - WAJIB isi nilai COURSE dan RPM sesuai angka yang tertera REAL-TIME di mesin!
   - Tekan [Simpan Konfigurasi].

3. JIKA MESIN RUSAK TOTAL / MATI LINTAS SHIFT
   - Gunakan tombol kuning [Mesin Mati] di bagian atas (tanpa produksi kain).

4. KONEKSI ESP32 & DOWNTIME OTOMATIS
   - Nomor panel otomatis berurutan melanjutkan shift lalu.
   - Pastikan ESP32 selalu TERHUBUNG agar timer otomatis jalan saat mesin stop.
   - Jika mesin jalan kembali, isi kendala pada modal masalah.
   - Jika mesin stop tetapi kain TIDAK cacat, pilih opsi [Gagal Cacat].

5. POTONG KAIN, CACAT BS & ISTIRAHAT
   - Potong Kain : Centang pada panel terakhir gulungan kain.
   - Cacat BS    : Tandai PCS yang cacatnya tidak dapat diselamatkan.
   - Istirahat   : Pilih status [Istirahat] dan tentukan OPERATOR BACKUP Anda.
   - Normal      : Pastikan status [Normal] jika sedang bertugas sendiri.

6. KIRIM LAPORAN
   - Klik tombol biru [KIRIM LAPORAN PANEL].
   - Tunggu konfirmasi berhasil.
================================================================================
```
