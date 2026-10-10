function definirCarregando(botao, carregando) {
  botao.classList.toggle('carregando', carregando);
  botao.disabled = carregando;
}

function mostrarTab(tab) {
  document.getElementById('formLogin').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('formRegistro').style.display = tab === 'registro' ? 'block' : 'none';
  document.getElementById('tabLogin').classList.toggle('ativo', tab === 'login');
  document.getElementById('tabRegistro').classList.toggle('ativo', tab === 'registro');
  document.getElementById('mensagemErro').textContent = '';
}

async function fazerLogin() {
  const btn = document.getElementById('btnLogin');
  const erroEl = document.getElementById('mensagemErro');
  definirCarregando(btn, true);

  try {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginSenha').value;

    const resp = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const textoResposta = await resp.text(); 
    let dados;

    try {
      dados = JSON.parse(textoResposta); 
    } catch (err) {
      console.error('[Auth Frontend Erro] A resposta da API não é um JSON válido. Resposta recebida:', textoResposta);
      erroEl.textContent = "Erro no servidor. Tente novamente mais tarde.";
      definirCarregando(btn, false);
      return;
    }

    if (!resp.ok) {
      console.error('[Auth Frontend Erro] Login falhou:', dados);
      erroEl.textContent = dados.error || 'Credenciais inválidas';
      return;
    }

    localStorage.setItem('username', dados.user.username);
    window.location.href = '/dashboard.html';
  } catch (err) {
    console.error('[Auth Frontend Crítico] Falha na execução do login:', err);
    erroEl.textContent = err.message;
  } finally {
    definirCarregando(btn, false);
  }
}

async function fazerRegistro() {
  const btn = document.getElementById('btnRegistro');
  const erroEl = document.getElementById('mensagemErro');

  const aceitouTermos = document.getElementById('aceitaTermos').checked;
  if (!aceitouTermos) {
    erroEl.textContent = 'Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.';
    return;
  }

  definirCarregando(btn, true);
  const fusoNavegador = Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regSenha').value;
    const account_type = document.getElementById('regTipo').value;

    const resp = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        email,
        password,
        account_type,
        timezone: fusoNavegador,
        accepted_terms: aceitouTermos ? 'true' : 'false'
      })
    });

    const dados = await resp.json();

    if (!resp.ok) {
      console.error('[Auth Frontend Erro] Falha no registo:', dados);
      erroEl.textContent = dados.error || (dados.errors && dados.errors[0].msg) || 'Erro ao processar registro';
      return;
    }

    // document.getElementById('emailDestino').textContent = email;
    // mostrarAbaVerificacao();

    document.getElementById('loginEmail').value = email;
    document.getElementById('loginSenha').value = password;
    mostrarTab('login');
    await fazerLogin();

  } catch (err) {
    console.error('[Auth Frontend Crítico] Falha na execução do registo:', err);
    erroEl.textContent = err.message;
  } finally {
    definirCarregando(btn, false);
  }
}

document.getElementById('tabLogin').onclick = () => mostrarTab('login');
document.getElementById('tabRegistro').onclick = () => mostrarTab('registro');
document.getElementById('btnLogin').onclick = fazerLogin;
document.getElementById('btnRegistro').onclick = fazerRegistro;

function mostrarAbaVerificacao() {
  document.getElementById('formLogin').style.display = 'none';
  document.getElementById('formRegistro').style.display = 'none';
  document.getElementById('formVerificacao').style.display = 'block';
  document.getElementById('mensagemErro').textContent = '';
  document.querySelector('.tabs').style.display = 'none'; 
}

async function confirmarCodigo() {
  const btn = document.getElementById('btnVerificar');
  const erroEl = document.getElementById('mensagemErro');
  const email = document.getElementById('emailDestino').textContent;
  const code = document.getElementById('codigoVerificacao').value;

  if (code.length < 6) {
    erroEl.textContent = 'Digite o código de 6 dígitos.';
    return;
  }

  definirCarregando(btn, true);

  try {
    const resp = await apiFetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });

    if (!resp.ok) {
      const dados = await resp.json();
      erroEl.textContent = dados.error || 'Código inválido';
      return;
    }

    document.getElementById('loginEmail').value = email;
    document.getElementById('loginSenha').value = document.getElementById('regSenha').value;
    
    document.querySelector('.tabs').style.display = 'flex';
    mostrarTab('login');
    await fazerLogin();

  } catch (err) {
    erroEl.textContent = err.message;
  } finally {
    definirCarregando(btn, false);
  }
}

document.getElementById('btnVerificar').onclick = confirmarCodigo;
document.getElementById('btnVoltarLogin').onclick = () => {
  document.querySelector('.tabs').style.display = 'flex';
  mostrarTab('login');
  document.getElementById('formVerificacao').style.display = 'none';
};