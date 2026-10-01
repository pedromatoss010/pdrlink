const { fileTypeFromBuffer } = require('file-type');

const ALLOWED_SIGNATURES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

async function verifyFileSignature(buffer) {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_SIGNATURES.includes(detected.mime)) {
    throw new Error('O conteúdo do arquivo não corresponde a uma imagem válida');
  }
}

module.exports = verifyFileSignature;