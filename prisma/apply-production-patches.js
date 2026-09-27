const { readFileSync } = require('fs');
const { join } = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const url = new URL(connectionString);
  const needsSsl =
    url.searchParams.get('sslmode') === 'require' ||
    url.hostname.includes('render.com');

  const client = new Client({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

  const sql = readFileSync(
    join(__dirname, 'production-faculty-crud-fields.sql'),
    'utf8',
  );

  await client.connect();
  try {
    await client.query(sql);
    console.log('Production schema patches applied');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Failed to apply production schema patches');
  console.error(error);
  process.exit(1);
});
