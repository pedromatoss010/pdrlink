const { Pool } = require('pg');
require('dotenv').config();

const sslConfig = process.env.DATABASE_CA_CERT
  ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT }
  : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig
});

module.exports = pool;