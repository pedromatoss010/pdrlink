const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { registerValidation } = require('../utils/validators');

const router = express.Router();

const RESERVED_USERNAMES = require('../utils/reservedUsernames');

const loginValidation = [
  body('email').trim().isEmail().withMessage('E-mail ou senha inválidos'),
  body('password').notEmpty().withMessage('E-mail ou senha inválidos')
];

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' }
});

const cookieOptionsBase = {
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

router.post('/register', registerLimiter, registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, account_type } = req.body;

  try {
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Formato de usuário inválido.' });
    }

    if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
      console.warn(`[Auth Aviso] Tentativa de registo com username reservado: ${username}`);
      return res.status(400).json({ error: 'Este nome de usuário não está disponível.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

      let validTimezone = 'America/Sao_Paulo';
      if (typeof timezone === 'string' && timezone.trim() !== '') {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
        validTimezone = timezone;
        } catch {
        validTimezone = 'America/Sao_Paulo';
        }
      }

      const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, account_type, accepted_terms_at, timezone)
       VALUES (LOWER($1), LOWER($2), $3, $4, NOW(), $5) RETURNING id, username, email`,
      [username, email, passwordHash, account_type || 'pessoa', validTimezone]
    );

    return res.status(201).json({ user: result.rows[0] });
    
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username ou e-mail já cadastrado' });
    }
    console.error('[Auth Erro] Falha no banco de dados ao cadastrar usuário:', err);
    return res.status(500).json({ error: 'Erro interno ao cadastrar usuário' });
  }
});

router.post('/login', loginValidation, loginLimiter, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "E-mail ou senha inválidos" });
  }
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const csrfToken = crypto.randomBytes(32).toString('hex');

    res.cookie('token', token, { ...cookieOptionsBase, httpOnly: true });
    res.cookie('csrfToken', csrfToken, { ...cookieOptionsBase, httpOnly: false });

    return res.json({ user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error('[Auth Erro] Falha interna no login:', err);
    return res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

router.post('/logout', (req, res) => {
  try {
    const { sameSite, secure } = cookieOptionsBase;
    res.clearCookie('token', { sameSite, secure, httpOnly: true });
    res.clearCookie('csrfToken', { sameSite, secure, httpOnly: false });
    return res.json({ message: 'Sessão encerrada' });
  } catch (err) {
    console.error('[Auth Erro] Falha ao encerrar sessão (logout):', err);
    return res.status(500).json({ error: 'Erro ao fazer logout' });
  }
});

module.exports = router;