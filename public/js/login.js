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

    const dados = await resp.json();

    if (!resp.ok) {
      erroEl.textContent = dados.error || 'Credenciais inválidas';
      return;
    }

    localStorage.setItem('username', dados.user.username);
    window.location.href = '/dashboard.html';
  } catch (err) {
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
      erroEl.textContent = dados.error || (dados.errors && dados.errors[0].msg) || 'Erro ao processar registro';
      return;
    }

    document.getElementById('loginEmail').value = email;
    document.getElementById('loginSenha').value = password;
    mostrarTab('login');
    await fazerLogin();
  } catch (err) {
    erroEl.textContent = err.message;
  } finally {
    definirCarregando(btn, false);
  }
}

document.getElementById('tabLogin').onclick = () => mostrarTab('login');
document.getElementById('tabRegistro').onclick = () => mostrarTab('registro');
document.getElementById('btnLogin').onclick = fazerLogin;
document.getElementById('btnRegistro').onclick = fazerRegistro;

// Se a URL vier com ?tab=registro (ex: link "Voltar" da página de termos),
// já abre direto na aba de cadastro em vez de sempre cair no login.
const parametroTab = new URLSearchParams(window.location.search).get('tab');
if (parametroTab === 'registro') {
  mostrarTab('registro');
}