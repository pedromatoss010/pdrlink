const express = require('express');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const requireAuth = require('../middleware/auth');
const verifyCsrf = require('../middleware/csrf');
const pool = require('../db');
const upload = require('../middleware/upload');
const uploadArquivo = require('../utils/uploadToSupabase');

const router = express.Router();

router.use(requireAuth);
router.use(verifyCsrf);

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitos envios de arquivo em pouco tempo. Tente novamente mais tarde.' }
});

const LIMITE_LINKS_POR_USUARIO = 50;

const ICONES_PRESET = [
  'whatsapp', 'instagram', 'tiktok', 'youtube', 'gmail',
  'site', 'localizacao', 'pix', 'x', 'linkedin',
  'twitch', 'discord', 'telegram', 'github'
];

const linkValidation = [
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Título obrigatório (máx 100 caracteres)'),
  body('url')
    .trim()
    .isURL({ require_protocol: true })
    .withMessage('URL inválida (precisa começar com http:// ou https://)'),
  body('icon_preset')
    .optional({ nullable: true })
    .isIn(ICONES_PRESET)
    .withMessage('Ícone inválido')
];

const reorderValidation = [
  body('order').isArray({ max: 100 }).withMessage('Lista de reordenação inválida ou grande demais'),
  body('order.*').custom(Number.isInteger).withMessage('Cada item da lista precisa ser um ID válido')
];

router.get('/icones-disponiveis', (req, res) => {
  res.json({ icones: ICONES_PRESET });
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, url, position, clicks, icon_url FROM links WHERE user_id = $1 ORDER BY position ASC, id ASC',
      [req.userId]
    );
    res.json({ links: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar links' });
  }
});

router.post('/', linkValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, url, icon_preset } = req.body;
  const iconUrl = icon_preset ? `/icons/${icon_preset}.svg` : null;

  try {
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM links WHERE user_id = $1',
      [req.userId]
    );
    if (parseInt(countResult.rows[0].count, 10) >= LIMITE_LINKS_POR_USUARIO) {
      return res.status(400).json({ error: `Limite de ${LIMITE_LINKS_POR_USUARIO} links atingido` });
    }

    const posResult = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM links WHERE user_id = $1',
      [req.userId]
    );
    const nextPosition = posResult.rows[0].next_position;

    const result = await pool.query(
      `INSERT INTO links (user_id, title, url, position, icon_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, title, url, position, clicks, icon_url`,
      [req.userId, title, url, nextPosition, iconUrl]
    );

    res.status(201).json({ link: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar link' });
  }
});

router.put('/reorder', reorderValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { order } = req.body;

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < order.length; i++) {
        await client.query(
          'UPDATE links SET position = $1 WHERE id = $2 AND user_id = $3',
          [i, order[i], req.userId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ message: 'Ordem atualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao reordenar links' });
  }
});

router.put('/:id', param('id').isInt(), linkValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, url } = req.body;
  const linkId = req.params.id;

  try {
    const result = await pool.query(
      `UPDATE links SET title = $1, url = $2
       WHERE id = $3 AND user_id = $4
       RETURNING id, title, url, position, clicks, icon_url`,
      [title, url, linkId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link não encontrado' });
    }

    res.json({ link: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao editar link' });
  }
});

router.delete('/:id', param('id').isInt(), async (req, res) => {
  const linkId = req.params.id;

  try {
    const result = await pool.query(
      'DELETE FROM links WHERE id = $1 AND user_id = $2 RETURNING id',
      [linkId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link não encontrado' });
    }

    res.json({ message: 'Link removido' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover link' });
  }
});

router.post('/:id/icon', uploadLimiter, (req, res) => {
  upload.single('icon')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const linkId = req.params.id;

    try {
      const user = await pool.query(
        'SELECT id FROM links WHERE id = $1 AND user_id = $2',
        [linkId, req.userId]
      );

      if (user.rows.length === 0) {
        return res.status(404).json({ error: 'Link não encontrado' });
      }

      const iconUrl = await uploadArquivo('links', req.file);

      const result = await pool.query(
        'UPDATE links SET icon_url = $1 WHERE id = $2 AND user_id = $3 RETURNING id, icon_url',
        [iconUrl, linkId, req.userId]
      );

      res.json({ icon_url: result.rows[0].icon_url });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao salvar ícone' });
    }
  });
});

module.exports = router;