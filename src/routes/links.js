const express = require('express');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const requireAuth = require('../middleware/auth');
const verifyCsrf = require('../middleware/csrf');
const pool = require('../db');
const upload = require('../middleware/upload');
const uploadArquivo = require('../utils/uploadToSupabase');
const { deleteFile } = require('../utils/uploadToSupabase');

const router = express.Router();

router.use(requireAuth);
router.use(verifyCsrf);

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitos envios de arquivo em pouco tempo. Tente novamente mais tarde.' }
});

const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Muitas alterações seguidas. Aguarde um minuto.' }
});

const LIMITE_LINKS_POR_USUARIO = 5;

const ICONES_PRESET = [
  'whatsapp', 'instagram', 'tiktok', 'youtube', 'gmail',
  'site', 'localizacao', 'pix', 'x', 'linkedin',
  'twitch', 'discord', 'telegram', 'github'
];

const linkValidation = [
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Título obrigatório (máx 100 caracteres)'),
  body('url')
    .trim()
    .isURL({ protocols: ['https'], require_protocol: true })
    .withMessage('URL inválida (precisa começar com https://)'),
  body('icon_preset')
    .optional({ nullable: true })
    .isIn(ICONES_PRESET)
    .withMessage('Ícone inválido')
];

const reorderValidation = [
  body('order').isArray({ max: 100 }).withMessage('Lista de reordenação inválida ou grande demais'),
  body('order.*').custom(Number.isInteger).withMessage('Cada item da lista precisa ser um ID válido'),

  body('order').custom((order) => {
    if (new Set(order).size !== order.length) {
      throw new Error('A lista de reordenação não pode ter IDs duplicados');
    }
    return true;
  })
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

router.post('/', mutationLimiter, linkValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, url, icon_preset } = req.body;
  const iconUrl = icon_preset ? `/icons/${icon_preset}.svg` : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Trava a linha do usuário durante o insert para evitar ultrapassar 5 links em concorrência
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.userId]);

    const countResult = await client.query(
      'SELECT COUNT(*) FROM links WHERE user_id = $1',
      [req.userId]
    );
    if (parseInt(countResult.rows[0].count, 10) >= LIMITE_LINKS_POR_USUARIO) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Limite de ${LIMITE_LINKS_POR_USUARIO} links atingido` });
    }

    const posResult = await client.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM links WHERE user_id = $1',
      [req.userId]
    );
    const nextPosition = posResult.rows[0].next_position;

    const result = await client.query(
      `INSERT INTO links (user_id, title, url, position, icon_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, title, url, position, clicks, icon_url`,
      [req.userId, title, url, nextPosition, iconUrl]
    );

    await client.query('COMMIT');
    res.status(201).json({ link: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar link' });
  } finally {
    client.release();
  }
});

router.put('/reorder', mutationLimiter, reorderValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { order } = req.body;

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const positions = order.map((_, i) => i);
      await client.query(
        `UPDATE links SET position = data.position 
        FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS position) AS data 
        WHERE links.id = data.id AND links.user_id = $3`,
        [order, positions, req.userId]
      );
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

router.put('/:id', mutationLimiter, param('id').isInt(), linkValidation, async (req, res) => {
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

router.delete('/:id', mutationLimiter, param('id').isInt(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'ID inválido' });

  const linkId = req.params.id;

  try {
    const result = await pool.query(
      'DELETE FROM links WHERE id = $1 AND user_id = $2 RETURNING id, icon_url',
      [linkId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link não encontrado' });
    }

    // Remove a imagem antiga do bucket se houver
    if (result.rows[0].icon_url) {
      await deleteFile(result.rows[0].icon_url);
    }

    res.json({ message: 'Link removido' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover link' });
  }
});

router.post('/:id/icon', uploadLimiter, param('id').isInt().withMessage('ID inválido'), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'ID inválido' });

  upload.single('icon')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: 'Arquivo inválido ou maior que 2MB' });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const linkId = req.params.id;

    try {
      const existing = await pool.query(
        'SELECT id, icon_url FROM links WHERE id = $1 AND user_id = $2',
        [linkId, req.userId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Link não encontrado' });
      }

      const oldIconUrl = existing.rows[0].icon_url;
      const iconUrl = await uploadArquivo('links', req.file);

      const result = await pool.query(
        'UPDATE links SET icon_url = $1 WHERE id = $2 AND user_id = $3 RETURNING id, icon_url',
        [iconUrl, linkId, req.userId]
      );

      // Remove o ícone antigo do Supabase Storage
      if (oldIconUrl) {
        await deleteFile(oldIconUrl);
      }

      res.json({ icon_url: result.rows[0].icon_url });
    } catch (err) {
      console.error(err);
      const status = err.message && err.message.includes('imagem válida') ? 400 : 500;
      res.status(status).json({ error: status === 400 ? err.message : 'Erro ao salvar ícone' });
    }
  });
});

module.exports = router;