/* ============================================================
   MAIN.JS — O Maestro do Projeto
   ============================================================
   Este arquivo é o "diretor de orquestra". Ele não toca
   instrumento, mas diz QUEM toca, QUANDO e em QUE ORDEM.

   FUNÇÕES DESTE ARQUIVO:
   1. Guardar o estado da tela (ano e filtros escolhidos)
   2. Montar os controles (ano, núcleo, situação, busca, botões)
   3. Mostrar o status de carregamento
   4. Calcular as estatísticas do topo
   5. Orquestrar a inicialização: dados → mapa → tabela
   6. Recarregar os dados quando a planilha for atualizada
   ============================================================ */

// ============================================================
// ESTADO DA TELA (variáveis globais)
// ============================================================
// POR QUE GLOBAIS: mapa.js, resumo.js e util.js precisam saber
// o que está selecionado para pintar, filtrar e classificar.
// São quatro variáveis e só main.js as altera — quem lê, lê;
// quem escreve, é sempre daqui.
//
// anoSelecionado começa no último ano da lista (o mais recente).
// ============================================================

let anoSelecionado = ANOS[ANOS.length - 1];
let filtroNucleo = "";     // "" = todos os núcleos
let filtroSituacao = "";   // "" = todas as situações
let filtroBusca = "";      // texto digitado na busca

// ============================================================
// setSyncBadge(estado, detalhe) — Indicador de status
// ============================================================
//   "ok"   → verde: dados carregados
//   "sync" → âmbar: carregando
//   "err"  → vermelho: erro
//
// POR QUE ISSO IMPORTA: o usuário precisa saber se pode confiar
// no que vê. Badge vermelho = não tome decisão com esses dados.
// ============================================================

function setSyncBadge(estado, detalhe) {
  const elemento = document.getElementById("sync-badge");

  const mapaCores = {
    ok: {
      texto: "🟢 dados carregados",
      fundo: "rgba(60,140,70,.25)",
      borda: "rgba(60,140,70,.55)"
    },
    sync: {
      texto: "🔄 carregando…",
      fundo: "rgba(181,101,29,.25)",
      borda: "rgba(181,101,29,.55)"
    },
    err: {
      texto: "⚠ erro ao carregar dados" + (detalhe ? " — " + detalhe : ""),
      fundo: "rgba(163,49,42,.25)",
      borda: "rgba(163,49,42,.55)"
    }
  };

  const config = mapaCores[estado] || mapaCores.sync;

  elemento.textContent = config.texto;
  elemento.style.background = config.fundo;
  elemento.style.borderColor = config.borda;
}

// ============================================================
// mostrarErro(mensagemHTML) — Banner vermelho no topo
// ============================================================
// Usa a mesma faixa do aviso de configuração, trocando as cores.
// ============================================================

function mostrarErro(mensagemHTML) {
  const banner = document.getElementById("config-banner");
  banner.style.display = "block";
  banner.style.background = "var(--err-bg)";
  banner.style.color = "var(--err)";
  banner.style.borderColor = "var(--err-bd)";
  banner.innerHTML = mensagemHTML;
}

// ============================================================
// mostrarAvisoConfiguracao() — Banner de URL não configurada
// ============================================================
// POR QUE TEMPLATE LITERAL (crase):
// Permite quebrar linhas e escrever aspas dentro do texto sem
// precisar escapar nada — e um "localizar e substituir" na URL
// não corre o risco de quebrar o arquivo.
// ============================================================

function mostrarAvisoConfiguracao() {
  const banner = document.getElementById("config-banner");
  banner.style.display = "block";
  banner.innerHTML = `⚠ Este mapa ainda não está conectado à planilha. Edite o arquivo <code>js/config.js</code> e troque <code>const API_URL_PADRAO = "COLE_AQUI_A_URL_DO_APPS_SCRIPT";</code> pela URL /exec do Apps Script, ou adicione <code>?api=SUA_URL</code> ao endereço desta página.`;
}

// ============================================================
// computeStats() — Calcula as 4 estatísticas do topo
// ============================================================
// COMO FUNCIONA:
// 1. Pega TODOS os nomes do GeoJSON (os 399 municípios do PR)
// 2. Para cada um, verifica a classificação
// 3. Conta quantos em cada categoria
//
// POR QUE CONTAR TODOS (inclusive fora do escopo):
// O número "Fora do escopo" mostra quantos municípios ainda NÃO
// entraram na pesquisa. É a medida de cobertura do trabalho.
//
// ATENÇÃO: as estatísticas ignoram os filtros de propósito. Elas
// são o panorama do estado; o recorte filtrado é contado no
// cabeçalho da tabela.
// ============================================================

function computeStats() {
  let paga = 0, naoPaga = 0, semDado = 0, fora = 0;

  const nomesGeo = Object.keys(window.__nomesGeoJSON || {});

  nomesGeo.forEach(function(nomeGeo) {
    const resultado = corDoMunicipio(nomeGeo);

    if (resultado.classe === "fora_escopo") fora++;
    else if (resultado.classe === "sem_dado") semDado++;
    else if (resultado.classe === "nao_paga") naoPaga++;
    else paga++;
  });

  document.getElementById("st-paga").textContent = paga;
  document.getElementById("st-naopaga").textContent = naoPaga;
  document.getElementById("st-semdado").textContent = semDado;
  document.getElementById("st-fora").textContent = fora;
}

// ============================================================
// atualizarTela() — Repinta tudo depois de uma mudança
// ============================================================
// Um lugar só para as três ações que sempre andam juntas: o mapa
// muda de cor, as estatísticas mudam de número e a tabela muda
// de conteúdo. Assim nenhuma delas fica para trás.
// ============================================================

function atualizarTela() {
  atualizarEstiloMapa();
  computeStats();
  renderPainelPerdas();
  renderResumo();
  renderGraficos();
}

// ============================================================
// configurarControles() — Monta seletores, busca e botões
// ============================================================
// O seletor de núcleo só pode ser preenchido DEPOIS que os dados
// chegam (os núcleos vêm da planilha). Por isso ele é populado
// em uma função separada, chamada mais tarde.
// ============================================================

function configurarControles() {
  // --- Ano ---
  const seletorAno = document.getElementById("f-ano");
  seletorAno.innerHTML = ANOS.map(function(ano) {
    const selecionado = ano === anoSelecionado ? "selected" : "";
    return `<option value="${ano}" ${selecionado}>${ano}</option>`;
  }).join("");

  seletorAno.addEventListener("change", function() {
    anoSelecionado = Number(seletorAno.value);
    atualizarTela();
  });

  // --- Situação ---
  const seletorSituacao = document.getElementById("f-situacao");
  seletorSituacao.addEventListener("change", function() {
    filtroSituacao = seletorSituacao.value;
    atualizarTela();
  });

  // --- Núcleo ---
  const seletorNucleo = document.getElementById("f-nucleo");
  seletorNucleo.addEventListener("change", function() {
    filtroNucleo = seletorNucleo.value;
    atualizarTela();
  });

  // --- Busca (com debounce) ---
  // Sem debounce, cada letra digitada dispara uma nova filtragem
  // e o navegador engasga. Com 300ms, só filtra quando o usuário
  // para de digitar.
  const campoBusca = document.getElementById("resumo-busca");
  campoBusca.addEventListener("input", debounce(function() {
    filtroBusca = campoBusca.value.trim();
    atualizarTela();
  }, 300));

  // --- Botão limpar filtros ---
  document.getElementById("btn-limpar").addEventListener("click", function() {
    filtroNucleo = "";
    filtroSituacao = "";
    filtroBusca = "";
    seletorNucleo.value = "";
    seletorSituacao.value = "";
    campoBusca.value = "";
    atualizarTela();
  });

  // --- Botão baixar CSV ---
  document.getElementById("btn-csv").addEventListener("click", baixarCSV);

  // --- Botão atualizar dados ---
  document.getElementById("btn-atualizar").addEventListener("click", recarregarDados);
}

// ============================================================
// popularNucleos() — Preenche o seletor de núcleos
// ============================================================
// Os núcleos saem da própria planilha, em ordem alfabética.
// Se amanhã a pesquisa incluir um núcleo novo, ele aparece aqui
// sozinho — ninguém precisa mexer no código.
// ============================================================

function popularNucleos() {
  const seletor = document.getElementById("f-nucleo");
  const nucleos = {};

  municipios.forEach(function(municipio) {
    if (municipio && municipio.nucleo) {
      nucleos[municipio.nucleo] = true;
    }
  });

  const lista = Object.keys(nucleos).sort(function(a, b) {
    return a.localeCompare(b, "pt-BR");
  });

  seletor.innerHTML = '<option value="">Todos os núcleos</option>' +
    lista.map(function(nucleo) {
      return `<option value="${escHtml(nucleo)}">${escHtml(nucleo)}</option>`;
    }).join("");

  seletor.value = filtroNucleo;
}

// ============================================================
// mostrarAtualizacao() — Hora da última sincronização
// ============================================================
// A planilha muda o tempo todo. Sem esse carimbo, quem abre a
// página não sabe se está vendo o levantamento de hoje ou uma
// resposta guardada em cache pelo navegador.
// ============================================================

function mostrarAtualizacao() {
  const alvo = document.getElementById("ultima-sync");
  const agora = new Date();

  let texto = "Consultado em " + agora.toLocaleString("pt-BR");

  if (metaDados && metaDados.atualizado) {
    const carimbo = new Date(metaDados.atualizado);
    if (!isNaN(carimbo.getTime())) {
      texto += " · planilha respondeu em " + carimbo.toLocaleString("pt-BR");
    }
  }

  alvo.textContent = texto;
}

// ============================================================
// recarregarDados() — Busca a planilha de novo, sem sair da página
// ============================================================
// Mantém ano, filtros e busca como estavam. Serve para conferir
// uma alteração recém-feita na planilha.
// ============================================================

async function recarregarDados() {
  const botao = document.getElementById("btn-atualizar");
  botao.disabled = true;
  setSyncBadge("sync");

  try {
    municipios = await carregarDados();
    indice = construirIndice(municipios);
    popularNucleos();
    atualizarTela();
    mostrarAtualizacao();
    setSyncBadge("ok");
    document.getElementById("config-banner").style.display = "none";
  } catch (erro) {
    setSyncBadge("err", String((erro && erro.message) || erro));
    mostrarErro(`⚠ Não foi possível recarregar a planilha. Os dados em tela continuam sendo os da última consulta bem-sucedida. Erro: <code>${escHtml(String(erro))}</code>`);
  } finally {
    botao.disabled = false;
  }
}

// ============================================================
// init() — FUNÇÃO PRINCIPAL: inicializa TUDO
// ============================================================
// ORDEM (cada passo depende do anterior):
// 1. Monta os controles da interface
// 2. Cria o mapa vazio
// 3. Confere se a URL da planilha está configurada
// 4. Busca os dados e monta o índice
// 5. Carrega o GeoJSON e desenha os municípios
// 6. Calcula estatísticas e renderiza a tabela
//
// TRY/CATCH: "tente fazer; se der erro, me avise" — em vez de a
// página simplesmente ficar em branco sem explicação.
// ============================================================

async function init() {
  configurarControles();
  criarMapa();

  if (!API_CONFIGURADA) {
    setSyncBadge("err", "URL não configurada");
    mostrarAvisoConfiguracao();
    document.getElementById("resumo-contagem").textContent = "aguardando configuração da URL da planilha";
    return;
  }

  setSyncBadge("sync");

  // --- Dados da planilha ---
  try {
    municipios = await carregarDados();
    indice = construirIndice(municipios);
    popularNucleos();
    mostrarAtualizacao();
    setSyncBadge("ok");
  } catch (erro) {
    setSyncBadge("err", String((erro && erro.message) || erro));
    document.getElementById("resumo-contagem").textContent = "erro ao carregar os dados";
    mostrarErro(`⚠ Não foi possível carregar os dados da planilha. Confira a URL do Apps Script (ela precisa terminar em <code>/exec</code> e estar implantada com acesso "Qualquer pessoa") e sua conexão. Erro: <code>${escHtml(String(erro))}</code>`);
    return;
  }

  // --- Painel de perdas, tabela e gráficos ---
  // Renderizados ANTES do mapa de propósito: nenhum deles depende do
  // GeoJSON. Se a malha geográfica falhar, o levantamento inteiro já
  // está na tela — só o mapa fica de fora.
  renderPainelPerdas();
  renderResumo();
  renderGraficos();

  // --- Mapa ---
  try {
    await carregarGeoJSON();
    computeStats();
  } catch (erro) {
    console.error("Erro ao carregar o GeoJSON dos municípios:", erro);
    mostrarErro(`⚠ Os dados carregaram normalmente, mas não foi possível desenhar o mapa (a malha geográfica dos municípios é buscada na internet). Os números, a tabela e os gráficos abaixo continuam válidos.`);
  }
}

// ============================================================
// INICIALIZAÇÃO AUTOMÁTICA
// ============================================================
// DOMContentLoaded = "o HTML terminou de carregar". Sem esperar
// por ele, o script tentaria achar o elemento do mapa antes de
// ele existir na página.
// ============================================================

document.addEventListener("DOMContentLoaded", init);
