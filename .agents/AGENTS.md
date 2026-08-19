# Workspace Rules

- Do NOT execute `git push` automatically. Always ask for explicit user permission or wait for direct request before pushing code to GitHub/remote repository.

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