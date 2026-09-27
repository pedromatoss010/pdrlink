const crypto = require('crypto');
const supabase = require('../supabaseClient');

async function uploadArquivo(pasta, file) {
  const extensao = file.mimetype.split('/')[1];
  const nomeUnico = `${pasta}/${crypto.randomBytes(16).toString('hex')}.${extensao}`;

  const { error } = await supabase.storage
    .from('uploads')
    .upload(nomeUnico, file.buffer, { contentType: file.mimetype });

  if (error) throw error;

  const { data } = supabase.storage.from('uploads').getPublicUrl(nomeUnico);
  return data.publicUrl;
}

module.exports = uploadArquivo;