const params = new URLSearchParams(window.location.search);


let username = new URLSearchParams(window.location.search).get('u');

if (!username) {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length > 0) {
    username = pathParts[0]; 
  }
}

async function carregarPagina() {
  const container = document.getElementById('conteudo');

  if (!username) {
    window.location.href='404.html'
    return 
  }

  let resp;
  try {
    resp = await apiFetch(`/api/public/${encodeURIComponent(username)}`);
  } catch (err) {
    console.error('Falha ao carregar perfil dinâmico:', err)
    window.location.href='500.html'
    return;
  }

  if (!resp.ok) {
    window.location.href='404.html'
    return;
  }

  const dados = await resp.json();
  container.innerHTML = '';

  const nomeExibicao = dados.display_name || dados.username;

  if (dados.avatar_url) {
    const img = document.createElement('img');
    img.src = dados.avatar_url;
    img.className = 'avatar-placeholder';
    img.alt = nomeExibicao;
    container.appendChild(img);
  } else {
    const div = document.createElement('div');
    div.className = 'avatar-placeholder';
    div.textContent = nomeExibicao.charAt(0).toUpperCase();
    container.appendChild(div);
  }

  const h1 = document.createElement('h1');
  h1.textContent = nomeExibicao;
  container.appendChild(h1);

  if (dados.bio) {
    const p = document.createElement('p');
    p.textContent = dados.bio;
    container.appendChild(p);
  }

  if (dados.account_type === 'loja') {
    const status = document.createElement('div');
    status.className = `status ${dados.is_open_now ? 'aberto' : 'fechado'}`;
    status.textContent = dados.is_open_now ? '● Aberto agora' : '● Fechado';
    container.appendChild(status);
  }

  dados.links.forEach(link => {
    const a = document.createElement('a');
    a.className = 'link-btn';
    a.href = `/r/${encodeURIComponent(link.id)}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    if (link.icon_url) {
      const img = document.createElement('img');
      img.src = link.icon_url;
      img.className = 'link-icon';
      img.alt = '';
      a.appendChild(img);
    }

    const span = document.createElement('span');
    span.textContent = link.title;
    a.appendChild(span);

    container.appendChild(a);
  });

  const watermark = document.createElement('a');
  watermark.href = '/login.html';
  watermark.className = 'watermark';
  watermark.innerHTML = 'Criado com <strong>pdrLink</strong>';
  container.appendChild(watermark);
}

carregarPagina();