const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');
const pool = require('../db');
const { registerValidation } = require('../utils/validators');
const requireAuth = require('../middleware/auth');
const verifyCsrf = require('../middleware/csrf');

const router = express.Router();

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
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, account_type, accepted_terms_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id, username, email`,
      [username, email, passwordHash, account_type || 'pessoa']
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username ou e-mail já cadastrado' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "E-mail ou senha inválidos" });
  }
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
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

    res.json({ user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

router.post('/logout', requireAuth, verifyCsrf, (req, res) => {
  const { sameSite, secure } = cookieOptionsBase;

  res.clearCookie('token', { sameSite, secure, httpOnly: true });
  res.clearCookie('csrfToken', { sameSite, secure, httpOnly: false });
  res.json({ message: 'Sessão encerrada' });
});

module.exports = router;