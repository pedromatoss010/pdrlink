const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'UPDATE links SET clicks = clicks + 1 WHERE id = $1 RETURNING url',
      [id]
    );

    if (result.rows.length === 0) {
      console.warn(`[Redirect Aviso] Tentativa de acesso a link inexistente. ID: ${id}`);
      return res.status(404).send('Link não encontrado');
    }

    return res.redirect(302, result.rows[0].url);
  } catch (err) {
    console.error(`[Redirect Crítico] Falha ao contabilizar clique e redirecionar ID ${id}:`, err);
    return res.status(500).send('Erro interno ao redirecionar');
  }
});

module.exports = router;