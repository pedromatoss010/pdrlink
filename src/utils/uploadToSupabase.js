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

module.exports = uploadFile;