const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='production_details'"))
  .then(res => {
    console.log("PRODUCTION_DETAILS COLUMNS:");
    console.log(res.rows);
    return client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='production_headers'");
  })
  .then(res => {
    console.log("PRODUCTION_HEADERS COLUMNS:");
    console.log(res.rows);
  })
  .finally(() => client.end());
