const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { registerValidation } = require('../utils/validators');
const verifyCsrf = require("../middleware/csrf");
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

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
    
     const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

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
      `INSERT INTO users (username, email, password_hash, account_type, accepted_terms_at, timezone, verification_token)
       VALUES (LOWER($1), LOWER($2), $3, $4, NOW(), $5, $6) RETURNING id, username, email`,
      [username, email, passwordHash, account_type || 'pessoa', validTimezone, verificationCode]
    );

    // try {
    //   await resend.emails.send({
    //     from: 'pdrLink Equipe <onboarding@resend.dev>',
    //     to: email,
    //     subject: 'Seu código de verificação - pdrLink',
    //     html: `
    //       <div style="font-family: sans-serif; text-align: center; padding: 40px 20px; color: #333;">
    //         <h2>Bem-vindo ao pdrLink!</h2>
    //         <p>Falta pouco para você ter o seu link na bio.</p>
    //         <p>Seu código de verificação é:</p>
    //         <h1 style="font-size: 36px; letter-spacing: 8px; color: #007bff; background: #f4f4f4; padding: 20px; border-radius: 8px; display: inline-block;">
    //           ${verificationCode}
    //         </h1>
    //         <p>Copie e cole este código na tela de cadastro para ativar sua conta.</p>
    //       </div>
    //     `
    //   });
    //   console.log(`[E-mail] Código enviado de verdade para ${email}`);
    // } catch (emailErr) {
    //   console.error('[E-mail Erro] Falha na API do Resend:', emailErr);
    // }
    
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

    // if (!user.email_verified) {
    //   return res.status(403).json({
    //     error: 'Verifique seu e-mail antes de fazer login.',
    //     needsVerification: true
    //   });
    // }

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

router.post('/logout', verifyCsrf, (req, res) => {
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

router.post('/verify-email', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), async (req, res) => {
  const { email, code } = req.body;
  
  try {
    const result = await pool.query('SELECT verification_token FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    const user = result.rows[0];

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (user.verification_token !== code) return res.status(400).json({ error: 'Código inválido ou incorreto.' });

    await pool.query('UPDATE users SET email_verified = true, verification_token = NULL WHERE LOWER(email) = LOWER($1)', [email]);
    
    return res.json({ message: 'E-mail verificado com sucesso!' });
  } catch (err) {
    console.error('[Auth Erro] Falha ao verificar e-mail:', err);
    return res.status(500).json({ error: 'Erro interno ao verificar código' });
  }
});

module.exports = router;