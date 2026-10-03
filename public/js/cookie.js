(function () {
  const CHAVE = 'pdrlink_cookie_consent';
  const escolhaAnterior = localStorage.getItem(CHAVE);

  function carregarScriptsNaoEssenciais() {
    console.log("Permissão concedida: A carregar scripts não essenciais...");
  }

  if (escolhaAnterior) {
    if (escolhaAnterior === 'todos') carregarScriptsNaoEssenciais();
    return;
  }

  const criarElemento = (tag, propriedades = {}, ...filhos) => {
    const el = Object.assign(document.createElement(tag), propriedades);
    el.append(...filhos); 
    return el;
  };

  const banner = criarElemento('div', { className: 'cookie-banner' },
    
    criarElemento('p', {},
      'Usamos cookies para melhorar sua experiência. Ao continuar navegando, você concorda com nossa ',
      criarElemento('a', { href: '/privacidade.html', textContent: 'Política de Privacidade' }),
      '.'
    ),
    
    criarElemento('div', { className: 'cookie-banner__acoes' },
      criarElemento('button', { 
        className: 'cookie-banner__rejeitar', 
        textContent: 'Somente essenciais',
        onclick: () => fechar('essenciais')
      }),
      criarElemento('button', { 
        className: 'cookie-banner__aceitar', 
        textContent: 'Aceitar todos',
        onclick: () => fechar('todos')
      })
    )
  );

  document.body.appendChild(banner);

  function fechar(escolha) {
    localStorage.setItem(CHAVE, escolha);
    banner.remove();
    if (escolha === 'todos') carregarScriptsNaoEssenciais();
  }
})();