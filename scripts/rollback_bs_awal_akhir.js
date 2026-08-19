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

async function rollback() {
  console.log("=== MEMULAI ROLLBACK BS AWAL & BS AKHIR ===");

  const snapshotPath = path.join(__dirname, 'backfill_snapshot.json');
  let headerIdsToDelete = [];

  if (fs.existsSync(snapshotPath)) {
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    headerIdsToDelete = snapshot.headerIds || [];
    console.log(`Membaca snapshot: ditemukan ${headerIdsToDelete.length} ID header untuk di-rollback.`);
  }

  if (headerIdsToDelete.length > 0) {
    // 1. Hapus details terlebih dahulu
    const { error: detErr } = await supabase
      .from("production_details")
      .delete()
      .in("header_id", headerIdsToDelete);

    if (detErr) {
      console.warn("Gagal hapus details by header_id:", detErr);
    }

    // 2. Hapus headers
    const { error: headErr } = await supabase
      .from("production_headers")
      .delete()
      .in("id", headerIdsToDelete);

    if (headErr) {
      console.error("Gagal hapus headers:", headErr);
      return;
    }

    console.log(`Berhasil menghapus ${headerIdsToDelete.length} header dari snapshot.`);
    fs.unlinkSync(snapshotPath);
  } else {
    // Fallback: hapus semua yang panel_no nya BS AWAL atau BS AKHIR
    console.log("Tidak ada snapshot. Menghapus semua row dengan panel_no 'BS AWAL' atau 'BS AKHIR'...");

    const { data: targetHeaders } = await supabase
      .from("production_headers")
      .select("id")
      .in("panel_no", ["BS AWAL", "BS AKHIR"]);

    if (targetHeaders && targetHeaders.length > 0) {
      const ids = targetHeaders.map(h => h.id);
      await supabase.from("production_details").delete().in("header_id", ids);
      await supabase.from("production_headers").delete().in("id", ids);
      console.log(`Berhasil membersihkan ${ids.length} header BS AWAL & BS AKHIR.`);
    } else {
      console.log("Tidak ada data BS AWAL / BS AKHIR yang ditemukan.");
    }
  }

  console.log("=== ROLLBACK SELESAI. Database telah kembali ke keadaan semula! ===");
}

rollback().catch(console.error);
