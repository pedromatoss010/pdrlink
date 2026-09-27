const express = require('express');
const { body, param, validationResult } = require('express-validator');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

const ICONES_PRESET = [
  'whatsapp', 'instagram', 'tiktok', 'facebook', 'youtube', 'email',
  'site', 'localizacao', 'telefone', 'pix', 'twitter', 'linkedin',
  'twitch', 'spotify', 'telegram', 'pinterest', 'kwai'
];

// Todas as rotas abaixo passam pelo requireAuth primeiro.
// Isso garante que req.userId sempre existe e vem de um token válido —
// nunca confiamos em um "user_id" que o cliente mande no corpo da requisição.
router.use(requireAuth);

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

// LISTAR meus links
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

// CRIAR link
router.post('/', linkValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, url, icon_preset } = req.body;
  const iconUrl = icon_preset ? `/icons/${icon_preset}.svg` : null;

  try {
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

// EDITAR link
router.put('/:id', param('id').isInt(), linkValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, url } = req.body;
  const linkId = req.params.id;

  try {
    const result = await pool.query(
      `UPDATE links SET title = $1, url = $2
       WHERE id = $3 AND user_id = $4
       RETURNING id, title, url, position, clicks`,
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

// DELETAR link
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

// REORDENAR links (recebe um array de IDs na nova ordem desejada)
router.put('/reorder', body('order').isArray(), async (req, res) => {
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

const upload = require('../middleware/upload');
const uploadArquivo = require('../utils/uploadToSupabase');

// Upload de ícone/logo pra um link específico
router.post('/:id/icon', (req, res) => {
  upload.single('icon')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const linkId = req.params.id;

    try {
      const iconUrl = await uploadArquivo('links', req.file);

      const result = await pool.query(
        'UPDATE links SET icon_url = $1 WHERE id = $2 AND user_id = $3 RETURNING id, icon_url',
        [iconUrl, linkId, req.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Link não encontrado' });
      }

      res.json({ icon_url: iconUrl });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao salvar ícone' });
    }
  });
});

module.exports = router;