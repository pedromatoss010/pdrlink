(function () {
  const CHAVE = 'pdrlink_cookie_consent';
  const escolhaAnterior = localStorage.getItem(CHAVE);

  function carregarScriptsNaoEssenciais() {
    console.log("Permissão concedida: A carregar scripts não essenciais...");
    // Lógica futura de rastreio aqui
  }

  if (escolhaAnterior) {
    if (escolhaAnterior === 'todos') carregarScriptsNaoEssenciais();
    return;
  }

  // 1. FUNÇÃO UTILITÁRIA (A "Fábrica" Profissional)
  // Cria o elemento, aplica atributos/classes e adiciona os filhos de forma 100% segura
  const criarElemento = (tag, propriedades = {}, ...filhos) => {
    const el = Object.assign(document.createElement(tag), propriedades);
    el.append(...filhos); // O .append converte texto solto em TextNodes automaticamente
    return el;
  };

  // 2. MONTAGEM DO BANNER (Limpa e estruturada, como se fosse HTML)
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

  // 3. AÇÃO DE FECHAR
  function fechar(escolha) {
    localStorage.setItem(CHAVE, escolha);
    banner.remove();
    if (escolha === 'todos') carregarScriptsNaoEssenciais();
  }
})();