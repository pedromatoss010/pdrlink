function verifyCsrf(req, res, next) {
  const metodosSeguro = ['GET', 'HEAD', 'OPTIONS'];
  if (metodosSeguro.includes(req.method)) return next();

  const cookieToken = req.cookies.csrfToken;
  const headerToken = req.get('x-csrf-token');

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Token CSRF inválido ou ausente' });
  }

  next();
}

module.exports = verifyCsrf;