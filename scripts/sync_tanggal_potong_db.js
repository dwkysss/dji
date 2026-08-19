const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function fetchAllHeaders() {
  let all = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('production_headers')
      .select('id, nomor_mc, potongan_ke, panel_no, tgl, tanggal_jam, tanggal_potong')
      .range(from, from + step - 1);
    if (error) {
      console.error('Error fetching range:', error);
      break;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < step) break;
    from += step;
  }
  return all;
}

async function main() {
  console.log('Fetching all production_headers with pagination...');
  const headers = await fetchAllHeaders();
  console.log(`Fetched ${headers.length} headers total.`);

  const groups = {};
  headers.forEach(h => {
    const key = `${h.nomor_mc}_${h.potongan_ke}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(h);
  });

  let totalUpdatedHeaders = 0;

  for (const key of Object.keys(groups)) {
    const list = groups[key];
    list.sort((a, b) => String(a.tanggal_jam || a.tgl).localeCompare(String(b.tanggal_jam || b.tgl)));
    
    const last = list[list.length - 1];
    const lastDate = (last.tanggal_jam || last.tgl || '').split('T')[0];
    const currentTglPotong = list.find(h => h.tanggal_potong && String(h.tanggal_potong).trim() !== '')?.tanggal_potong;

    let correctTglPotong = currentTglPotong;
    if (!correctTglPotong || correctTglPotong < lastDate) {
      correctTglPotong = lastDate;
    }

    const headersToUpdate = list.filter(h => h.tanggal_potong !== correctTglPotong);

    if (headersToUpdate.length > 0) {
      const ids = headersToUpdate.map(h => h.id);
      
      // Update in chunks of 200
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error: updateError } = await supabase
          .from('production_headers')
          .update({ tanggal_potong: correctTglPotong })
          .in('id', chunk);

        if (updateError) {
          console.error(`Error updating batch ${key}:`, updateError);
        } else {
          totalUpdatedHeaders += chunk.length;
        }
      }
    }
  }

  console.log(`Done! Total headers updated: ${totalUpdatedHeaders}`);
}

main();
