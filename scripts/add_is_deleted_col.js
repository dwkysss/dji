const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to Postgres");

    const query = `
      ALTER TABLE public.production_details
      ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
    `;

    await client.query(query);
    console.log("Successfully added is_deleted column to production_details");
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await client.end();
  }
}

run();
