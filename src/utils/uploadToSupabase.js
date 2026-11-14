const crypto = require('crypto');
const supabase = require('../supabaseClient');
const verifyFileSignature = require('./verifyFileSignature');

async function uploadFile(folder, file) {
  const detected = await verifyFileSignature(file.buffer);
  const uniqueName = `${folder}/${crypto.randomBytes(16).toString('hex')}.${detected.ext}`;

  const { error } = await supabase.storage
    .from('uploads')
    .upload(uniqueName, file.buffer, { contentType: detected.mime });

  if (error) throw error;

  const { data } = supabase.storage.from('uploads').getPublicUrl(uniqueName);
  return data.publicUrl;
}

async function deleteFile(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return;
  const marker = '/storage/v1/object/public/uploads/';
  const index = publicUrl.indexOf(marker);
  if (index === -1) return; 

  const filePath = publicUrl.substring(index + marker.length);
  if (!filePath) return;

  const { error } = await supabase.storage.from('uploads').remove([filePath]);
  if (error) {
    console.error('[Supabase Storage] Falha ao remover arquivo antigo:', error.message);
  }
}

module.exports = uploadFile;
module.exports.deleteFile = deleteFile;