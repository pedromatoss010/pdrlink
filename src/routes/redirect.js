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
      return res.status(404).send('Link não encontrado');
    }

    res.redirect(302, result.rows[0].url);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao redirecionar');
  }
});

module.exports = router;