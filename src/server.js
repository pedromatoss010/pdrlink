const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const linksRoutes = require('./routes/links');
const hoursRoutes = require('./routes/hours');
const publicRoutes = require('./routes/public');
const redirectRoutes = require('./routes/redirect');
const profileRoutes = require('./routes/profile');

const app = express();

const RESERVED_USERNAMES = require('./utils/reservedUsernames')

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"]
    }
  }
}));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/hours', hoursRoutes);
app.use('/api/public', publicRoutes);
app.use('/r', redirectRoutes);
app.use('/api/profile', profileRoutes);

app.get('/:username', (req, res, next) => {
  const username = req.params.username.toLowerCase();

  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return next(); 
  }

  if (RESERVED_USERNAMES.includes(username)) {
    return next(); 
  }

  return res.sendFile(path.join(process.cwd(), 'public', 'perfil.html'));
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição' });
  }

  console.error('[API Crítico] Falha inesperada no servidor:', err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
});

app.use((req, res) => {
  return res.status(404).sendFile(path.join(process.cwd(), 'public', '404.html'));
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

module.exports = app;