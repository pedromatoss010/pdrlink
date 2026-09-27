const { Pool } = require('pg');
require('dotenv').config();

// O Pool gerencia várias conexões com o banco de forma eficiente,
// em vez de abrir e fechar uma conexão nova a cada requisição.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } 
});

module.exports = pool;