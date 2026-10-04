function definirCarregando(botao, carregando) {
  botao.classList.toggle('carregando', carregando);
  botao.disabled = carregando;
}

const username = localStorage.getItem('username');

document.getElementById('linkPagina').href = `/${encodeURIComponent(username || '')}`;

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

let ICONES_PRESET = [];

async function carregarIconesDisponiveis() {
  const resp = await apiFetch('/api/links/icones-disponiveis');
  const dados = await resp.json();
  ICONES_PRESET = dados.icones;
  montarPresetGrid();
}

let contaTipo = 'pessoa';
let nomeAtual = '';
let presetSelecionado = null;
let linksAtuais = [];

function montarPresetGrid() {
  const grid = document.getElementById('presetIconGrid');
  grid.innerHTML = '';

  ICONES_PRESET.forEach(nome => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-opcao';
    btn.dataset.nome = nome;
    btn.onclick = () => selecionarPreset(nome);

    const img = document.createElement('img');
    img.src = `/icons/${nome}.svg`;
    img.alt = nome;
    btn.appendChild(img);

    grid.appendChild(btn);
  });
}

function selecionarPreset(nome) {
  presetSelecionado = presetSelecionado === nome ? null : nome;
  document.querySelectorAll('.preset-opcao').forEach(btn => {
    btn.classList.toggle('selecionado', btn.dataset.nome === presetSelecionado);
  });
}

function renderizarAvatar(avatarUrl) {
  const preview = document.getElementById('avatarPreview');
  preview.innerHTML = '';

  if (avatarUrl) {
    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = 'Avatar';
    preview.appendChild(img);
  } else {
    preview.textContent = (nomeAtual || username || '?').charAt(0).toUpperCase();
  }
}

async function enviarAvatar() {
  const input = document.getElementById('avatarInput');
  if (!input.files[0]) return;

  try {
    const formData = new FormData();
    formData.append('avatar', input.files[0]);

    const resp = await apiFetch('/api/profile/avatar', {
      method: 'POST',
      body: formData
    });

    const dados = await resp.json();

    if (!resp.ok) {
      alert(dados.error || 'Erro ao enviar foto');
      return;
    }

    renderizarAvatar(dados.avatar_url);
  } catch (err) {
    alert(err.message);
  }
}

function montarLinhasHorario(horarios) {
  const lista = document.getElementById('listaHorario');
  lista.innerHTML = '';

  DIAS.forEach((nomeDia, i) => {
    const h = horarios.find(x => x.day_of_week === i) || { open_time: '09:00', close_time: '18:00', closed: false };
    const open = (h.open_time || '09:00:00').slice(0, 5);
    const close = (h.close_time || '18:00:00').slice(0, 5);

    const linha = document.createElement('div');
    linha.className = 'horario-linha';

    const spanDia = document.createElement('span');
    spanDia.className = 'horario-dia';
    spanDia.textContent = nomeDia;

    const inputOpen = document.createElement('input');
    inputOpen.type = 'time';
    inputOpen.id = `open-${i}`;
    inputOpen.value = open;
    inputOpen.disabled = h.closed;

    const inputClose = document.createElement('input');
    inputClose.type = 'time';
    inputClose.id = `close-${i}`;
    inputClose.value = close;
    inputClose.disabled = h.closed;

    const label = document.createElement('label');
    label.className = 'horario-fechado';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `closed-${i}`;
    checkbox.checked = h.closed;
    checkbox.onchange = () => toggleDiaFechado(i);
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode('Fechado'));

    linha.appendChild(spanDia);
    linha.appendChild(inputOpen);
    linha.appendChild(inputClose);
    linha.appendChild(label);
    lista.appendChild(linha);
  });
}

function toggleDiaFechado(i) {
  const fechado = document.getElementById(`closed-${i}`).checked;
  document.getElementById(`open-${i}`).disabled = fechado;
  document.getElementById(`close-${i}`).disabled = fechado;
}

async function carregarPerfil() {
  try {
    const resp = await apiFetch('/api/profile');

    if (resp.status === 401) {
      window.location.href = '/login.html';
      return;
    }

    const dados = await resp.json();
    const perfil = dados.profile;

    contaTipo = perfil.account_type;
    nomeAtual = perfil.display_name || '';
    document.getElementById('perfilNome').value = perfil.display_name || '';
    document.getElementById('perfilBio').value = perfil.bio || '';

    renderizarAvatar(perfil.avatar_url);

    if (contaTipo === 'loja') {
      document.getElementById('secaoHorario').style.display = 'block';

      const respHoras = await apiFetch('/api/hours');
      const dadosHoras = await respHoras.json();
      montarLinhasHorario(dadosHoras.hours || []);
    }
  } catch (err) {
    document.getElementById('erroPerfil').textContent = err.message;
  }
}

async function salvarPerfil() {
  const btn = document.getElementById('btnSalvarPerfil');
  const erroEl = document.getElementById('erroPerfil');
  definirCarregando(btn, true);

  try {
    const display_name = document.getElementById('perfilNome').value;
    const bio = document.getElementById('perfilBio').value;
    erroEl.textContent = '';

    const respPerfil = await apiFetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name, bio })
    });

    if (!respPerfil.ok) {
      const dados = await respPerfil.json();
      erroEl.textContent = dados.error || (dados.errors && dados.errors[0].msg) || 'Erro ao salvar perfil';
      return;
    }

    nomeAtual = display_name;

    if (contaTipo === 'loja') {
      const hours = DIAS.map((_, i) => ({
        day_of_week: i,
        open_time: document.getElementById(`open-${i}`).value,
        close_time: document.getElementById(`close-${i}`).value,
        closed: document.getElementById(`closed-${i}`).checked
      }));

      const respHoras = await apiFetch('/api/hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours })
      });

      if (!respHoras.ok) {
        const dados = await respHoras.json();
        erroEl.textContent = dados.error || 'Erro ao salvar horário';
        return;
      }
    }

    erroEl.style.color = 'var(--success)';
    erroEl.textContent = 'Perfil salvo!';
    setTimeout(() => { erroEl.textContent = ''; erroEl.style.color = ''; }, 2000);
  } catch (err) {
    erroEl.textContent = err.message;
  } finally {
    definirCarregando(btn, false);
  }
}

function criarItemLink(link, index, total) {
  const div = document.createElement('div');
  div.className = 'link-item';
  div.id = `link-${link.id}`;

  if (link.icon_url) {
    const img = document.createElement('img');
    img.src = link.icon_url;
    img.className = 'link-icon-preview';
    img.alt = '';
    div.appendChild(img);
  } else {
    const vazio = document.createElement('div');
    vazio.className = 'link-icon-vazio';
    div.appendChild(vazio);
  }

  const info = document.createElement('div');
  info.className = 'link-info';
  info.id = `view-${link.id}`;

  const strong = document.createElement('strong');
  strong.textContent = link.title;

  const span = document.createElement('span');
  span.textContent = `📊 ${link.clicks} cliques registrados`;

  info.appendChild(strong);
  info.appendChild(span);
  div.appendChild(info);

  const moverBox = document.createElement('div');
  moverBox.className = 'link-mover';

  const btnSubir = document.createElement('button');
  btnSubir.className = 'btn-mover';
  btnSubir.innerHTML = '▲';
  btnSubir.disabled = index === 0;
  btnSubir.onclick = () => moverLink(link.id, -1);

  const btnDescer = document.createElement('button');
  btnDescer.className = 'btn-mover';
  btnDescer.innerHTML = '▼';
  btnDescer.disabled = index === total - 1;
  btnDescer.onclick = () => moverLink(link.id, 1);

  moverBox.appendChild(btnSubir);
  moverBox.appendChild(btnDescer);
  div.appendChild(moverBox);

  const actions = document.createElement('div');
  actions.className = 'link-actions';
  actions.id = `actions-${link.id}`;

  const inputIcon = document.createElement('input');
  inputIcon.type = 'file';
  inputIcon.id = `icon-input-${link.id}`;
  inputIcon.accept = 'image/png, image/jpeg, image/webp, image/gif';
  inputIcon.style.display = 'none';
  inputIcon.onchange = () => enviarIconeLink(link.id);

  const btnLogo = document.createElement('button');
  btnLogo.className = 'btn-editar';
  btnLogo.textContent = 'Logo';
  btnLogo.onclick = () => inputIcon.click();

  const btnEditar = document.createElement('button');
  btnEditar.className = 'btn-editar';
  btnEditar.textContent = 'Editar';
  btnEditar.onclick = () => abrirEdicao(link.id);

  const btnApagar = document.createElement('button');
  btnApagar.className = 'btn-remover';
  btnApagar.textContent = 'Apagar';
  btnApagar.onclick = () => deletarLink(link.id);

  actions.appendChild(inputIcon);
  actions.appendChild(btnLogo);
  actions.appendChild(btnEditar);
  actions.appendChild(btnApagar);
  div.appendChild(actions);

  return div;
}

function renderizarListaLinks() {
  const lista = document.getElementById('listaLinks');
  lista.innerHTML = '';
  linksAtuais.forEach((link, i) => lista.appendChild(criarItemLink(link, i, linksAtuais.length)));
}

async function carregarLinks() {
  try {
    const resp = await apiFetch('/api/links');

    if (resp.status === 401) {
      window.location.href = '/login.html';
      return;
    }

    const dados = await resp.json();
    linksAtuais = dados.links;
    renderizarListaLinks();
  } catch (err) {
    document.getElementById('listaLinks').textContent = err.message;
  }
}

async function moverLink(id, direcao) {
  const index = linksAtuais.findIndex(l => l.id === id);
  const novoIndex = index + direcao;
  if (novoIndex < 0 || novoIndex >= linksAtuais.length) return;

  [linksAtuais[index], linksAtuais[novoIndex]] = [linksAtuais[novoIndex], linksAtuais[index]];
  renderizarListaLinks();

  try {
    const order = linksAtuais.map(l => l.id);

    const resp = await apiFetch('/api/links/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order })
    });

    if (!resp.ok) carregarLinks();
  } catch (err) {
    alert(err.message);
    carregarLinks();
  }
}

async function enviarIconeLink(id) {
  const input = document.getElementById(`icon-input-${id}`);
  if (!input.files[0]) return;

  try {
    const formData = new FormData();
    formData.append('icon', input.files[0]);

    const resp = await apiFetch(`/api/links/${id}/icon`, {
      method: 'POST',
      body: formData
    });

    const dados = await resp.json();

    if (!resp.ok) {
      alert(dados.error || 'Erro ao enviar logo');
      return;
    }

    carregarLinks();
  } catch (err) {
    alert(err.message);
  }
}

function abrirEdicao(id) {
  const link = linksAtuais.find(l => l.id === id);
  if (!link) return;

  const view = document.getElementById(`view-${id}`);
  const actions = document.getElementById(`actions-${id}`);

  view.innerHTML = '';
  const inputTitle = document.createElement('input');
  inputTitle.type = 'text';
  inputTitle.id = `edit-title-${id}`;
  inputTitle.value = link.title;

  const inputUrl = document.createElement('input');
  inputUrl.type = 'text';
  inputUrl.id = `edit-url-${id}`;
  inputUrl.value = link.url;

  view.appendChild(inputTitle);
  view.appendChild(inputUrl);

  actions.innerHTML = '';
  const btnSalvar = document.createElement('button');
  btnSalvar.className = 'btn-editar';
  btnSalvar.textContent = 'Salvar';
  btnSalvar.onclick = () => salvarEdicao(id);

  const btnCancelar = document.createElement('button');
  btnCancelar.className = 'btn-remover';
  btnCancelar.textContent = 'Cancelar';
  btnCancelar.onclick = () => carregarLinks();

  actions.appendChild(btnSalvar);
  actions.appendChild(btnCancelar);
}

async function salvarEdicao(id) {
  try {
    const title = document.getElementById(`edit-title-${id}`).value;
    const url = document.getElementById(`edit-url-${id}`).value;

    const resp = await apiFetch(`/api/links/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, url })
    });

    if (resp.ok) {
      carregarLinks();
    } else {
      const dados = await resp.json();
      alert(dados.error || (dados.errors && dados.errors[0].msg) || 'Erro ao editar link');
    }
  } catch (err) {
    alert(err.message);
  }
}

async function criarLink() {
  const btn = document.getElementById('btnCriarLink');
  definirCarregando(btn, true);

  try {
    const title = document.getElementById('novoTitulo').value;
    const url = document.getElementById('novaUrl').value;

    const resp = await apiFetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, url, icon_preset: presetSelecionado })
    });

    if (resp.ok) {
      document.getElementById('novoTitulo').value = '';
      document.getElementById('novaUrl').value = '';
      presetSelecionado = null;
      document.querySelectorAll('.preset-opcao').forEach(btn => btn.classList.remove('selecionado'));
      carregarLinks();
    } else {
      const dados = await resp.json();
      alert(dados.error || 'Falha ao criar o link');
    }
  } catch (err) {
    alert(err.message);
  } finally {
    definirCarregando(btn, false);
  }
}

async function deletarLink(id) {
  try {
    await apiFetch(`/api/links/${id}`, { method: 'DELETE' });
    carregarLinks();
  } catch (err) {
    alert(err.message);
  }
}

async function sair() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    localStorage.removeItem('username');
    window.location.href = '/login.html';
  }
}

const copyLinkBtn = document.getElementById('btnCopyLink');
if (copyLinkBtn) {
  copyLinkBtn.addEventListener('click', async () => {
    const pageUrlElement = document.getElementById('linkPagina');
    const pageUrl = pageUrlElement.href;

    if (!pageUrl || pageUrl.endsWith('#')) return;

    try {
      await navigator.clipboard.writeText(pageUrl);
      
      const originalText = copyLinkBtn.innerText;
      copyLinkBtn.innerText = '✓ Link Copiado!';
      copyLinkBtn.classList.add('copied');

      setTimeout(() => {
        copyLinkBtn.innerText = originalText;
        copyLinkBtn.classList.remove('copied');
      }, 2500);

    } catch (err) {
      console.error('Failed to copy link:', err);
      const originalText = copyLinkBtn.innerText;
      copyLinkBtn.innerText = 'Erro ao copiar';
      
      setTimeout(() => {
        copyLinkBtn.innerText = originalText;
      }, 2500);
    }
  });
}

document.getElementById('btnSair').onclick = sair;
document.getElementById('avatarInput').onchange = enviarAvatar;
document.getElementById('btnSalvarPerfil').onclick = salvarPerfil;
document.getElementById('btnCriarLink').onclick = criarLink;

carregarIconesDisponiveis();
carregarPerfil();
carregarLinks();