const multer = require('multer');

const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const TAMANHO_MAXIMO = 2 * 1024 * 1024; // 2MB

// Guarda o arquivo em memória (buffer), não em disco —
// necessário pra depois enviar pro Supabase Storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido. Use PNG, JPEG, WEBP ou GIF.'));
    }
    cb(null, true);
  }
});

module.exports = upload;