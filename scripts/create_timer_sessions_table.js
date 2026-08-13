const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
console.log('dbUrl exists:', !!dbUrl);

if (!dbUrl) {
  console.log('No DB URL found in env');
  process.exit(0);
}

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  console.log('Connected to PG!');
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.inspection_timer_sessions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      nomor_mc TEXT NOT NULL,
      design_id TEXT NOT NULL,
      potongan_ke TEXT NOT NULL,
      pcs_index TEXT NOT NULL,
      start_time TIMESTAMPTZ NOT NULL,
      elapsed_seconds INT DEFAULT 0,
      pause_seconds INT DEFAULT 0,
      is_paused BOOLEAN DEFAULT FALSE,
      paused_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE public.inspection_timer_sessions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all timer sessions" ON public.inspection_timer_sessions;
    CREATE POLICY "Allow all timer sessions" ON public.inspection_timer_sessions FOR ALL USING (true) WITH CHECK (true);
  `);
  
  console.log('Successfully created inspection_timer_sessions table and RLS policies!');
  await client.end();
}

run().catch(e => {
  console.error('Migration error:', e);
  process.exit(1);
});
