const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const verifyCsrf = require('../middleware/csrf');
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

const profileValidation = [
  body('display_name').trim().isLength({ max: 100 }),
  body('bio').trim().isLength({ max: 300 }),
  body('account_type').optional().isIn(['pessoa', 'loja']).withMessage('Tipo de conta inválido')
];

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT username, display_name, bio, avatar_url, account_type FROM users WHERE id = $1',
      [req.userId]
    );
    res.json({ profile: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

router.put('/', profileValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { display_name, bio, account_type } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users
          SET display_name = $1,
              bio = $2,
              account_type = COALESCE($3, account_type)
        WHERE id = $4
        RETURNING username, display_name, bio, avatar_url, account_type`,
      [display_name, bio, account_type || null, req.userId]
    );
    res.json({ profile: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

router.post('/avatar', uploadLimiter, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: 'Arquivo inválido ou maior que 2MB' });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    try {
      const current = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [req.userId]);
      const oldAvatarUrl = current.rows[0]?.avatar_url;

      const avatarUrl = await uploadArquivo('avatars', req.file);
      await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.userId]);

      // Remove a foto antiga do Supabase Storage
      if (oldAvatarUrl) {
        await deleteFile(oldAvatarUrl);
      }

      res.json({ avatar_url: avatarUrl });
    } catch (err) {
      console.error(err);
      const status = err.message && err.message.includes('imagem válida') ? 400 : 500;
      res.status(status).json({ error: status === 400 ? err.message : 'Erro ao salvar avatar' });
    }
  });
});

module.exports = router;