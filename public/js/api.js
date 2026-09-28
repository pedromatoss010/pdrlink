function getCookie(nome) {
  const encontrado = document.cookie.split('; ').find(linha => linha.startsWith(`${nome}=`));
  return encontrado ? decodeURIComponent(encontrado.split('=')[1]) : null;
}

async function apiFetch(url, options = {}) {
  try {
    const metodo = (options.method || 'GET').toUpperCase();
    const headers = { ...(options.headers || {}) };

    // Só métodos que mudam dado (POST, PUT, DELETE) precisam do token CSRF —
    // GET nunca muda nada no servidor, então não é alvo desse tipo de ataque.
    if (metodo !== 'GET') {
      const csrfToken = getCookie('csrfToken');
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
    }

    return await fetch(url, { ...options, headers, credentials: 'include' });
  } catch (err) {
    throw new Error('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.');
  }
}