async function apiFetch(url, options = {}) {
  try {
    // credentials: 'include' garante que o cookie httpOnly seja enviado em toda chamada
    return await fetch(url, { ...options, credentials: 'include' });
  } catch (err) {
    throw new Error('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.');
  }
}