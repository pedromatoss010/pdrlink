const params = new URLSearchParams(window.location.search);
const username = params.get('u');

function mostrarErro(container, titulo, texto) {
  container.innerHTML = '';
  const h1 = document.createElement('h1');
  h1.textContent = titulo;
  const p = document.createElement('p');
  p.textContent = texto;
  container.appendChild(h1);
  container.appendChild(p);
}

async function carregarPagina() {
  const container = document.getElementById('conteudo');

  if (!username) {
    mostrarErro(container, '404', 'Usuário não localizado.');
    return;
  }

  let resp;
  try {
    resp = await apiFetch(`/api/public/${encodeURIComponent(username)}`);
  } catch (err) {
    mostrarErro(container, 'Erro de conexão', err.message);
    return;
  }

  if (!resp.ok) {
    mostrarErro(container, '404', 'Página não encontrada no servidor.');
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