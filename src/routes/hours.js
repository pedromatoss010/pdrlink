const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const verifyCsrf = require('../middleware/csrf');

const router = express.Router();
router.use(requireAuth);
router.use(verifyCsrf);

const validTimeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;

const hoursValidation = [
  body('hours').isArray({ min: 7, max: 7 }).withMessage('Envie os 7 dias da semana (0=domingo a 6=sábado)'),
  body('hours.*.day_of_week').isInt({ min: 0, max: 6 }),
  body('hours.*.closed').isBoolean(),
  body('hours.*.open_time').optional({ nullable: true }).matches(validTimeFormat).withMessage('Horário de abertura inválido'),
  body('hours.*.close_time').optional({ nullable: true }).matches(validTimeFormat).withMessage('Horário de fechamento inválido'),
  body('hours').custom((hours) => {
    const days = hours.map((h) => h.day_of_week).sort((a, b) => a - b);
    const expected = [0, 1, 2, 3, 4, 5, 6];
    const isValid = days.length === 7 && days.every((day, i) => day === expected[i]);
    if (!isValid) throw new Error('Os 7 dias da semana devem estar presentes, sem repetição');
    return true;
  })
];

router.put('/', hoursValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { hours } = req.body;

  for (const day of hours) {
    if (!day.closed && (!day.open_time || !day.close_time)) {
      return res.status(400).json({ error: `Dia ${day.day_of_week}: precisa de open_time e close_time se não estiver fechado` });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM business_hours WHERE user_id = $1', [req.userId]);

    for (const day of hours) {
      await client.query(
        `INSERT INTO business_hours (user_id, day_of_week, open_time, close_time, closed)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.userId, day.day_of_week, day.open_time || null, day.close_time || null, day.closed]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Horário atualizado' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar horário' });
  } finally {
    client.release();
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT day_of_week, open_time, close_time, closed FROM business_hours WHERE user_id = $1 ORDER BY day_of_week',
      [req.userId]
    );
    res.json({ hours: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar horário' });
  }
});

module.exports = router;