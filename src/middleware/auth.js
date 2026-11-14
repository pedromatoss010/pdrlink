const jwt = require('jsonwebtoken');
const pool = require('../db');

async function requireAuth(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    const result = await pool.query(
      'SELECT token_version FROM users WHERE id = $1',
      [payload.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const currentVersion = result.rows[0].token_version || 1;
    if (payload.tokenVersion && payload.tokenVersion !== currentVersion) {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }

    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

module.exports = requireAuth;