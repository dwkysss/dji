# Workspace Rules

- Do NOT execute `git push` automatically. Always ask for explicit user permission or wait for direct request before pushing code to GitHub/remote repository.
- Eksekusi `npx tsc --noEmit` untuk verifikasi TypeScript dapat dijalankan langsung secara proaktif tanpa perlu meminta izin pengguna terlebih dahulu.

# Cara Penampilan Tabel dengan jenis inputan panel
- di baris pertama data, kolom tanggal, group dan operator wajib terisi
- kolom tanggal hanya ditampilkan atau bernilai ketika baris data pertama atau jika tanggalnya sudah berbeda dari baris pertama tersebut. Juga ditampilkan ketika beda operator
- data pada kolom group hanya ditampilkan di baris pertama, ditampilkan juga ketika nama operator nya beda
- kolom operator berisi nama operator di baris pertama data operator tersebut aja
- pengeculian untuk kolom operator, dapat berisi "Istirahat" jika data tersebut berlabel istirahat
- ketika data ada label istirahatnya, maka nama operator backup tampil di kolom keterangan cacat, jika ada detail masalah juga tampil di kolom keterangan cacat di bawah nama operator backup tersebut
- jika data dengan label istirahat di baris pertama, maka prioritas data yang tampil di kolom operator adalah nama operator

# Tampilan Tab
- ketika membuat sebuah layout, set juga layout untuk tampilan di tab (tab mengikuti tampilan laptop)

# Seorang UI UX yang handal
- selalu responsive dengan ukuran layar berapapun (desktop, mobile, tablet)
- ketika membuat sebuah layout, selalu pikirkan bagaimana user akan berinteraksi dengan layout tersebut
- selalu pikirkan tentang user experience agar user tidak kesulitan saat menggunakan aplikasi

# Cara Perhitungan Panel
- di halaman riwayat input, untuk perhitungan tidak menyertakan panel BS (sudah benar)
- di halaman inspeksi dan halaman mending, panel BS tetap dihitung
- baris BS AWAL dan BS AKHIR dihitung masing-masing 1 panel BS secara individual (bukan digabung jadi 1)
- untuk halaman Laporan Bulanan, kolom produksi diisi nilai dengan panel BS tidak disertakan
- untuk halaman Laporan Potong Kain, kolom Roll/Panel menyertakan panel BS ya
- untuk penentuan Grade Keseluruhan (Overall Grade), perhitungan mengambil data SETELAH INSPECT (hasil mending), dan nilai panel BS AWAL serta BS AKHIR tidak disertakan dalam perhitungan total panel maupun total cacat.
- untuk kain meteran, jika temuan cacat berupa titik tunggal, dihitung 1 meter/titik cacat. Jika temuan cacat berupa rentang (range), jumlah cacat dihitung dari selisih panjangnya (Meter Akhir - Meter Awal). Contoh: rentang 410 - 420 dihitung sebagai 10 meter cacat.

# Cara Penampilan Data Tambahan QC & Mending
- Semua data panel/titik cacat tambahan yang diinput dari halaman QC maupun Mending diseragamkan menggunakan badge "+ QC" (tidak ada badge + MND).
- Seluruh baris data tambahan QC/Mending diberi warna background biru muda (bg-sky-50).
- Teks rincian cacat dan catatan khusus QC/Mending ditampilkan dengan warna biru (text-[#0070bc]), bukan merah cacat produksi.
- Data tambahan QC/Mending tetap wajib diinspeksi/grading dan dihitung pada total kalkulasi inspeksi serta laporan.
- Jika ada data dengan detail masalah, kemudian ditambahkan keterangan masalah baru di bagian inspek atau mending maka warna keterangan masalah dari bagian operator tidak berubah yakni berwarna merah, dan tambahan di bagian inspek atau mending berwarna biru
- penambahan keterangan masalah di halaman inspek atau mending tidak menyertakan nomor blok


# Cara penanganan mesin Tricote atau Mesin dengan awalan jenis T
- saya ada satu informasi, bahwa untuk hasil dari mesin Tricote atau mesin dengan awalan T, itu inspek dan mendingnya bersamaan (melakukan inspek, jika ada cacat langsung diperbaiki), maka apakah bisa ketika setelah mengisi inspek, maka mendingnya otomatis diisi sama dan langsung masuk menjadi laporan produksi dan ada hasil grade keseluruhan seperti setelah mengisi mending di mesin normal.