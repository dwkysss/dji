const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('No DB URL found in env');
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const INITIAL_QC_DEFECTS = [
  { nama: "L1 Putus", kategori: "Benang", urutan: 1 },
  { nama: "L2 Putus", kategori: "Benang", urutan: 2 },
  { nama: "Bolong Corak", kategori: "Corak & Rajutan", urutan: 3 },
  { nama: "Bolong Bredel", kategori: "Corak & Rajutan", urutan: 4 },
  { nama: "BT Keluar Jarum", kategori: "Jarum & Benang", urutan: 5 },
  { nama: "BT Lolos", kategori: "Benang", urutan: 6 },
  { nama: "BT Kejepit", kategori: "Benang", urutan: 7 },
  { nama: "Floating Kerajut", kategori: "Corak & Rajutan", urutan: 8 },
  { nama: "BT Narik Jalan", kategori: "Benang", urutan: 9 },
  { nama: "BT Narik", kategori: "Benang", urutan: 10 },
  { nama: "Kotor Karat", kategori: "Kebersihan & Noda", urutan: 11 },
  { nama: "Kotor Oli", kategori: "Kebersihan & Noda", urutan: 12 },
  { nama: "Pinggiran Kebabad", kategori: "Finishing & Pinggiran", urutan: 13 },
  { nama: "Benang Kendor", kategori: "Benang", urutan: 14 },
];

async function run() {
  await client.connect();
  console.log('Connected to Postgres...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.master_qc_defects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nama_cacat TEXT NOT NULL UNIQUE,
      kategori TEXT DEFAULT 'Umum',
      keterangan TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE public.master_qc_defects ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all master_qc_defects" ON public.master_qc_defects;
    CREATE POLICY "Allow all master_qc_defects" ON public.master_qc_defects FOR ALL USING (true) WITH CHECK (true);
  `);

  console.log('Table master_qc_defects created / verified.');

  for (const item of INITIAL_QC_DEFECTS) {
    await client.query(`
      INSERT INTO public.master_qc_defects (nama_cacat, kategori, sort_order, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (nama_cacat) DO UPDATE 
      SET kategori = EXCLUDED.kategori, sort_order = EXCLUDED.sort_order;
    `, [item.nama, item.kategori, item.urutan]);
  }

  console.log('Seeded initial QC defects successfully!');
  const res = await client.query('SELECT count(*) FROM public.master_qc_defects;');
  console.log('Total master_qc_defects count:', res.rows[0].count);

  await client.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
