const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function findDuplicateHeaders() {
  const { data: headers, error } = await supabase
    .from('production_headers')
    .select('id, panel_no, nomor_mc, design_id, potongan_ke, tgl, tanggal_jam, pic')
    .order('nomor_mc')
    .order('potongan_ke');

  if (error) {
    console.error(error);
    return;
  }

  const batchMap = {};
  headers.forEach((h) => {
    const key = `${h.nomor_mc}_${h.design_id}_${h.potongan_ke}_${h.panel_no}`;
    if (!batchMap[key]) batchMap[key] = [];
    batchMap[key].push(h);
  });

  let duplicates = 0;
  for (const [key, list] of Object.entries(batchMap)) {
    if (list.length > 1) {
      duplicates++;
      console.log(`Duplicate header for panel key "${key}": ${list.length} records`);
      list.forEach((h) => {
        console.log(`  id: ${h.id} | tgl: ${h.tgl} | tanggal_jam: ${h.tanggal_jam} | pic: ${h.pic}`);
      });
    }
  }

  console.log(`Total duplicate header panel instances: ${duplicates}`);
}

findDuplicateHeaders();
