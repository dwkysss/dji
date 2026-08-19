require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase credentials not found in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function generateExcelStyleId() {
  const chars = "abcdef0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function backfill() {
  console.log("=== MEMULAI BACKFILL LENGKAP SEMUA DATA BS AWAL & BS AKHIR ===");

  // 1. Ambil SELURUH data production_headers menggunakan pagination
  let allHeaders = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    console.log(`Mengambil data header range ${from} - ${from + pageSize - 1}...`);
    const { data: pageData, error: pageError } = await supabase
      .from("production_headers")
      .select("*, production_details(*)")
      .not("potongan_ke", "is", null)
      .not("panel_no", "eq", "METERAN")
      .order("tanggal_jam", { ascending: true })
      .range(from, from + pageSize - 1);

    if (pageError) {
      console.error("Gagal mengambil data headers:", pageError);
      return;
    }

    if (!pageData || pageData.length === 0) {
      hasMore = false;
    } else {
      allHeaders = allHeaders.concat(pageData);
      if (pageData.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    }
  }

  console.log(`Total ${allHeaders.length} header panel berhasil diambil dari database.`);

  // 2. Kelompokkan berdasarkan Batch (nomor_mc + design_id + potongan_ke)
  const batchGroups = {};
  for (const h of allHeaders) {
    const key = `${h.nomor_mc || 'UNKNOWN'}_${h.design_id || 'UNKNOWN'}_${h.potongan_ke}`;
    if (!batchGroups[key]) {
      batchGroups[key] = [];
    }
    batchGroups[key].push(h);
  }

  const batchKeys = Object.keys(batchGroups);
  console.log(`Ditemukan ${batchKeys.length} batch potongan.`);

  const insertedHeaders = [];
  const insertedDetails = [];

  for (const key of batchKeys) {
    const group = batchGroups[key];
    if (group.length === 0) continue;

    const hasBsAwal = group.some(h => String(h.panel_no || "").trim().toUpperCase() === "BS AWAL");
    const hasBsAkhir = group.some(h => String(h.panel_no || "").trim().toUpperCase() === "BS AKHIR");
    
    // Cari tanggal potong jika ada di salah satu panel dalam batch
    const cutDateHeader = group.find(h => h.tanggal_potong && String(h.tanggal_potong).trim() !== "");
    const tanggalPotong = cutDateHeader ? cutDateHeader.tanggal_potong : null;

    // Cek apakah batch ini masih dalam proses inspeksi (pending) atau sudah selesai inspeksi
    const allDetailsInBatch = group.flatMap(h => h.production_details || []);
    const isPendingQC = allDetailsInBatch.some(d => d.final_inspection_id === null || d.final_inspection_id === undefined);
    
    // Jika masih dalam proses inspeksi (pending), final_inspection_id harus null agar muncul di QC screen!
    // Jika sudah diinspeksi sebelumnya, beri final_inspection_id = 4 (BS).
    const targetFinalInspectionId = isPendingQC ? null : 4;

    const firstHeader = group[0];
    const lastHeader = group[group.length - 1];
    const pcsCount = firstHeader.pcs || (firstHeader.production_details && firstHeader.production_details.length > 0 ? firstHeader.production_details.length : 1);

    // A. Buat BS AWAL jika belum ada
    if (!hasBsAwal) {
      const bsAwalHeaderId = generateExcelStyleId();
      const bsAwalHeader = {
        id: bsAwalHeaderId,
        tgl: firstHeader.tgl,
        tanggal_jam: firstHeader.tanggal_jam,
        operator_id: firstHeader.operator_id,
        group_id: firstHeader.group_id,
        design_id: firstHeader.design_id,
        nomor_mc: firstHeader.nomor_mc,
        status_matching: firstHeader.status_matching,
        course: firstHeader.course,
        rpm: firstHeader.rpm,
        potongan_ke: firstHeader.potongan_ke,
        panel_no: "BS AWAL",
        pcs: pcsCount,
        tanggal_potong: tanggalPotong,
        pick: firstHeader.pick,
        no_order_barang: firstHeader.no_order_barang,
        no_customer: firstHeader.no_customer,
        jenis_benang_dasar: firstHeader.jenis_benang_dasar,
        liner: firstHeader.liner,
        heavy: firstHeader.heavy,
        shadow: firstHeader.shadow,
        pinggiran: firstHeader.pinggiran,
        total_downtime_detik: 0,
        idempotency_key: null,
        created_by_name: firstHeader.created_by_name,
        pic: firstHeader.pic,
        operator_backup: null
      };

      const bsAwalDetailsList = [];
      for (let pIdx = 1; pIdx <= pcsCount; pIdx++) {
        bsAwalDetailsList.push({
          id: generateExcelStyleId() + "-bs-awal-" + pIdx,
          header_id: bsAwalHeaderId,
          pcs_index: pIdx,
          jml_hasil_produksi: 0,
          indikator_stop: false,
          kategori_masalah: "BS",
          detail_masalah: "Sisa Awal Potongan",
          spesifik_masalah: null,
          keterangan_cacat: "Sisa Awal Potongan",
          meter_kain: null,
          status_inspeksi: "BS",
          final_inspection_id: targetFinalInspectionId
        });
      }

      insertedHeaders.push(bsAwalHeader);
      insertedDetails.push(...bsAwalDetailsList);
      console.log(`[+] Menyiapkan BS AWAL untuk ${key} (isPendingQC: ${isPendingQC})`);
    }

    // B. Buat BS AKHIR jika potongan sudah dipotong & belum ada BS AKHIR
    if (!hasBsAkhir && tanggalPotong) {
      const bsAkhirHeaderId = generateExcelStyleId();
      const bsAkhirHeader = {
        id: bsAkhirHeaderId,
        tgl: lastHeader.tgl,
        tanggal_jam: lastHeader.tanggal_jam,
        operator_id: lastHeader.operator_id,
        group_id: lastHeader.group_id,
        design_id: lastHeader.design_id,
        nomor_mc: lastHeader.nomor_mc,
        status_matching: lastHeader.status_matching,
        course: lastHeader.course,
        rpm: lastHeader.rpm,
        potongan_ke: lastHeader.potongan_ke,
        panel_no: "BS AKHIR",
        pcs: pcsCount,
        tanggal_potong: tanggalPotong,
        pick: lastHeader.pick,
        no_order_barang: lastHeader.no_order_barang,
        no_customer: lastHeader.no_customer,
        jenis_benang_dasar: lastHeader.jenis_benang_dasar,
        liner: lastHeader.liner,
        heavy: lastHeader.heavy,
        shadow: lastHeader.shadow,
        pinggiran: lastHeader.pinggiran,
        total_downtime_detik: 0,
        idempotency_key: null,
        created_by_name: lastHeader.created_by_name,
        pic: lastHeader.pic,
        operator_backup: null
      };

      const bsAkhirDetailsList = [];
      for (let pIdx = 1; pIdx <= pcsCount; pIdx++) {
        bsAkhirDetailsList.push({
          id: generateExcelStyleId() + "-bs-akhir-" + pIdx,
          header_id: bsAkhirHeaderId,
          pcs_index: pIdx,
          jml_hasil_produksi: 0,
          indikator_stop: false,
          kategori_masalah: "BS",
          detail_masalah: "Sisa Akhir Potongan",
          spesifik_masalah: null,
          keterangan_cacat: "Sisa Akhir Potongan",
          meter_kain: null,
          status_inspeksi: "BS",
          final_inspection_id: targetFinalInspectionId
        });
      }

      insertedHeaders.push(bsAkhirHeader);
      insertedDetails.push(...bsAkhirDetailsList);
      console.log(`[+] Menyiapkan BS AKHIR untuk ${key} (isPendingQC: ${isPendingQC})`);
    }
  }

  if (insertedHeaders.length === 0) {
    console.log("Semua potongan lama sudah memiliki BS AWAL dan BS AKHIR.");
    return;
  }

  console.log(`\nMenyimpan ${insertedHeaders.length} headers dan ${insertedDetails.length} details ke Supabase...`);

  // Simpan snapshot untuk rollback
  const snapshotPath = path.join(__dirname, 'backfill_snapshot.json');
  let existingSnapshot = { headerIds: [], detailIds: [] };
  if (fs.existsSync(snapshotPath)) {
    try { existingSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')); } catch (e) {}
  }
  
  fs.writeFileSync(snapshotPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    headerIds: [...(existingSnapshot.headerIds || []), ...insertedHeaders.map(h => h.id)],
    detailIds: [...(existingSnapshot.detailIds || []), ...insertedDetails.map(d => d.id)]
  }, null, 2));

  // Insert Header Batch (pecah jadi chunks jika > 200)
  for (let i = 0; i < insertedHeaders.length; i += 200) {
    const chunk = insertedHeaders.slice(i, i + 200);
    const { error: insHeaderErr } = await supabase.from("production_headers").insert(chunk);
    if (insHeaderErr) {
      console.error("Gagal insert headers chunk:", insHeaderErr);
      return;
    }
  }

  // Insert Details Batch (pecah jadi chunks jika > 200)
  for (let i = 0; i < insertedDetails.length; i += 200) {
    const chunk = insertedDetails.slice(i, i + 200);
    const { error: insDetErr } = await supabase.from("production_details").insert(chunk);
    if (insDetErr) {
      console.error(`Gagal insert details chunk ${i}:`, insDetErr);
      return;
    }
  }

  console.log(`\n=== BERHASIL! ${insertedHeaders.length} baris (BS AWAL/AKHIR) dan ${insertedDetails.length} rincian detail telah ditambahkan ke database ===`);
}

backfill().catch(console.error);
