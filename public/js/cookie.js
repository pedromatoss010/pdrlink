(function () {
  const CHAVE = 'pdrlink_cookie_consent';

  // Se a pessoa já escolheu antes, não mostra o banner de novo
  if (localStorage.getItem(CHAVE)) return;

  const banner = document.createElement('div');
  banner.className = 'cookie-banner';
  // Texto fixo, escrito por nós — seguro usar innerHTML aqui,
  // porque não vem de nenhum dado digitado por usuário.
  banner.innerHTML = `
    <p>
      Usamos cookies para melhorar sua experiência. Ao continuar navegando, você concorda com nossa
      <a href="/privace.html">Política de Privacidade</a>.
    </p>
    <div class="cookie-banner__acoes">
      <button class="cookie-banner__rejeitar">Somente essenciais</button>
      <button class="cookie-banner__aceitar">Aceitar todos</button>
    </div>
  `;

  document.body.appendChild(banner);

  function fechar(escolha) {
    localStorage.setItem(CHAVE, escolha);
    banner.remove();
  }

  banner.querySelector('.cookie-banner__aceitar').onclick = () => fechar('todos');
  banner.querySelector('.cookie-banner__rejeitar').onclick = () => fechar('essenciais');
})();