/* ============================================================
   MAPA.JS — Tudo relacionado ao Leaflet (mapa interativo)
   ============================================================
   Este arquivo é o "pintor do mapa". Ele cuida de:
   1. Criar o mapa vazio
   2. Adicionar o "fundo" (tiles do CartoDB/OpenStreetMap)
   3. Desenhar os polígonos dos municípios (GeoJSON)
   4. Pintar cada município com a cor certa
   5. Criar popups (balões de informação)
   6. Adicionar a legenda

   PENSE ASSIM: se o projeto fosse uma maquete da cidade,
   este arquivo seria quem monta a base, cola os prédios
   e pinta cada um com a cor do zoneamento.
   ============================================================ */

// ============================================================
// VARIÁVEIS GLOBAIS DO MAPA
// ============================================================
// map: objeto principal do Leaflet (o mapa em si)
// geoLayer: camada com os polígonos dos municípios
//
// O que é uma "camada" (layer)?
// Imagine o mapa como uma pilha de folhas de papel transparente:
// - Folha 1: o fundo (ruas, rios)
// - Folha 2: os polígonos dos municípios (coloridos)
// - Folha 3: os nomes dos municípios (tooltips)
// Cada folha é uma "camada" que pode ser adicionada/removida.
// ============================================================

let map = null;
let geoLayer = null;

// ============================================================
// criarMapa() — Inicializa o mapa vazio
// ============================================================
// O QUE FAZ: Cria o mapa, define o ponto central (Paraná)
// e adiciona o fundo (tiles).
//
// COORDENADAS [-24.89, -51.55]:
//   -24.89 = latitude (quão ao sul/norte, negativo = sul)
//   -51.55 = longitude (quão a leste/oeste, negativo = oeste)
//   Zoom 7 = vê quase todo o estado do Paraná
//
// TILES (https://{s}.basemaps.cartocdn.com/light_all/...):
// São "azulejos" de imagem que o Leaflet baixa e junta
// para formar o mapa. Usamos o CartoDB "light_all" porque
// é limpo, com cores suaves, não compete com nossas cores.
//
// scrollWheelZoom: true = permite zoom com a rodinha do mouse
// ============================================================

function criarMapa() {
  map = L.map("map", { scrollWheelZoom: true }).setView([-24.89, -51.55], 7);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap © CARTO",
  }).addTo(map);

  // Adiciona a legenda no canto inferior direito
  adicionarLegenda();
}

// ============================================================
// adicionarLegenda() — Caixinha explicando as cores
// ============================================================
// O QUE FAZ: Cria um quadrado no canto do mapa mostrando
// o significado de cada cor.
//
// POR QUE É IMPORTANTE:
// Sem legenda, ninguém sabe o que as cores significam!
// É como um gráfico de pizza sem rótulos.
// ============================================================

function adicionarLegenda() {
  const legenda = L.control({ position: "bottomright" });

  legenda.onAdd = function() {
    const div = L.DomUtil.create("div", "legend");
    div.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px;">Situação</div>
      <div><span class="dot" style="background:${CORES.paga}"></span>Paga o piso</div>
      <div><span class="dot" style="background:${CORES.nao_paga}"></span>Não paga o piso</div>
      <div><span class="dot" style="background:${CORES.sem_dado}"></span>Acompanhado, sem dado ainda</div>
      <div><span class="dot" style="background:${CORES.fora_escopo}"></span>Fora do escopo</div>
    `;
    return div;
  };

  legenda.addTo(map);
}

// ============================================================
// estiloPorFeature(feature) — Decide como pintar cada município
// ============================================================
// O QUE FAZ: Recebe um município do GeoJSON e retorna o estilo
// (cor, espessura da borda, opacidade).
//
// POR QUE DIFERENTES ESTILOS:
// - FORA DO ESCOPO: cinza claro, borda fina, quase transparente
//   (não queremos chamar atenção)
// - SEM DADO: âmbar, borda discreta, opacidade média
//   (chama atenção levemente, pois precisamos de dados)
// - PAGA/NÃO PAGA: cores fortes, borda escura, opacidade alta
//   (são os mais importantes, merecem destaque)
//
// PROPRIEDADES DO ESTILO:
//   fillColor: cor de preenchimento
//   weight: espessura da borda (em pixels)
//   opacity: opacidade da borda (0=invisível, 1=opaco)
//   color: cor da borda
//   fillOpacity: opacidade do preenchimento (0=transparente, 1=opaco)
// ============================================================

function estiloPorFeature(feature) {
  const nomeGeo = feature.properties.name;
  const resultado = corDoMunicipio(nomeGeo);

  // Se o usuário aplicou filtros (núcleo/situação), os municípios que ficam
  // de fora do filtro são apagados no mapa — assim o recorte da tabela e o
  // recorte do mapa contam a mesma história.
  if (resultado.municipio && !passaFiltros(resultado.municipio)) {
    return {
      fillColor: CORES.fora_escopo,
      weight: 1,
      opacity: 1,
      color: "#ccc",
      fillOpacity: 0.15
    };
  }

  // Fora do escopo: quase invisível
  if (resultado.classe === "fora_escopo") {
    return {
      fillColor: resultado.cor,
      weight: 1,
      opacity: 1,
      color: "#ccc",
      fillOpacity: 0.25
    };
  }

  // Sem dado: visível mas discreto
  if (resultado.classe === "sem_dado") {
    return {
      fillColor: resultado.cor,
      weight: 1,
      opacity: 1,
      color: "#8a7440",
      fillOpacity: 0.45
    };
  }

  // Paga ou não paga: destaque máximo
  return {
    fillColor: resultado.cor,
    weight: 1.3,
    opacity: 1,
    color: "#1c2b3a",
    fillOpacity: 0.8
  };
}

// ============================================================
// carregarGeoJSON() — Busca e desenha os municípios no mapa
// ============================================================
// O QUE FAZ:
// 1. Busca o arquivo GeoJSON na internet (GitHub)
// 2. Guarda todos os nomes dos municípios em __nomesGeoJSON
// 3. Desenha cada município como um polígono colorido
// 4. Adiciona interatividade (tooltip, popup, hover)
//
// O QUE É GEOJSON?
// É um formato de texto que descreve formas geográficas.
// Cada município é um "Feature" com:
//   - properties: { name: "Maringá", ... }
//   - geometry: { type: "Polygon", coordinates: [...] }
//
// A URL usada é um projeto aberto no GitHub com dados do IBGE.
// ============================================================

async function carregarGeoJSON() {
  const urlGeoJSON = "https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-41-mun.json";

  const resposta = await fetch(urlGeoJSON);
  const geoJsonData = await resposta.json();

  // Guarda todos os nomes dos municípios do GeoJSON
  // Isso é usado depois para calcular estatísticas
  window.__nomesGeoJSON = {};
  geoJsonData.features.forEach(function(feature) {
    window.__nomesGeoJSON[feature.properties.name] = true;
  });

  // Cria a camada com os polígonos
  geoLayer = L.geoJSON(geoJsonData, {
    style: estiloPorFeature,
    onEachFeature: configurarInteratividade
  }).addTo(map);
}

// ============================================================
// configurarInteratividade(feature, layer) — Cliques e hovers
// ============================================================
// O QUE FAZ: Para CADA município desenhado, configura:
// 1. Tooltip (nome ao passar o mouse)
// 2. Popup (balão ao clicar)
// 3. Hover (destaca ao passar o mouse, volta ao normal ao sair)
//
// POR QUE USAR FUNÇÃO NO bindPopup:
// Em vez de criar o HTML do popup imediatamente (que seria
// lento para 400 municípios), passamos uma FUNÇÃO que só
// cria o HTML quando o usuário CLICA. Isso economiza memória.
// ============================================================

function configurarInteratividade(feature, layer) {
  const nomeGeo = feature.properties.name;

  // Tooltip: nome + situação + valor praticado, sem precisar clicar.
  // É o "identificar município e piso praticado" na forma mais rápida.
  layer.bindTooltip(function() {
    return textoTooltip(nomeGeo);
  }, { sticky: true });

  // Popup: balão de informação ao clicar
  // Usamos função para criar o HTML só no momento do clique
  layer.bindPopup(function() {
    return conteudoPopup(corDoMunicipio(nomeGeo).municipio);
  }, { maxWidth: 320 });

  // Hover: destaca a borda ao passar o mouse
  layer.on("mouseover", function() {
    this.setStyle({ weight: 2.5 });
  });

  // Mouseout: volta ao estilo normal ao tirar o mouse
  layer.on("mouseout", function() {
    geoLayer.resetStyle(this);
  });
}

// ============================================================
// atualizarEstiloMapa() — Recolore o mapa quando muda o ano
// ============================================================
// O QUE FAZ: Quando o usuário muda o ano no seletor,
// chama esta função para repintar todos os municípios.
//
// POR QUE NÃO RECRIAR O MAPA:
// Recriar seria lento. O setStyle só muda as cores,
// mantendo tudo o mais (posição, zoom, popups abertos).
// ============================================================

// ============================================================
// textoTooltip(nomeGeo) — Resumo de uma linha ao passar o mouse
// ============================================================
// Mostra: nome do município, valor praticado no ano em tela e a
// distância para o piso nacional daquele ano.
// ============================================================

function textoTooltip(nomeGeo) {
  const resultado = corDoMunicipio(nomeGeo);
  const municipio = resultado.municipio;

  if (!municipio) {
    return "<b>" + escHtml(nomeGeo) + "</b><br><span style=\'color:#5b6572\'>fora do escopo</span>";
  }

  const info = situacaoNoAnoOuAnterior(municipio, anoSelecionado);
  let linha;

  if (!info) {
    linha = "sem valor levantado";
  } else {
    const dif = diferencaParaPiso(info.valor, info.ano);
    let comparacao = "";
    if (dif !== null) {
      if (Math.abs(dif) < 0.005) comparacao = " · no piso";
      else if (dif > 0) comparacao = " · " + fmt(dif) + " acima do piso";
      else comparacao = " · " + fmt(Math.abs(dif)) + " abaixo do piso";
    }
    linha = fmt(info.valor) + " (" + info.ano + ")" + comparacao;
  }

  return "<b>" + escHtml(municipio.municipio) + "</b><br>" + escHtml(linha);
}

function atualizarEstiloMapa() {
  if (geoLayer) {
    geoLayer.setStyle(estiloPorFeature);
  }
}

// ============================================================
// centralizarNoMunicipio(nomeMunicipio) — Zoom em um município
// ============================================================
// O QUE FAZ: Quando o usuário clica numa linha da tabela,
// centraliza o mapa naquele município e abre o popup.
//
// COMO FUNCIONA:
// 1. Normaliza o nome do município
// 2. Procura em todas as camadas do mapa
// 3. Quando acha, dá zoom e abre o popup
// ============================================================

function centralizarNoMunicipio(nomeMunicipio) {
  if (!geoLayer) return;

  const chaveAlvo = ALIASES[normalizar(nomeMunicipio)] || normalizar(nomeMunicipio);

  geoLayer.eachLayer(function(layer) {
    if (layer.feature && normalizar(layer.feature.properties.name) === chaveAlvo) {
      // Traz o mapa para a tela antes de dar o zoom: quem clicou numa linha
      // da tabela está com o mapa fora do campo de visão.
      document.querySelector(".map-shell").scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
      map.fitBounds(layer.getBounds(), { maxZoom: 10 });
      layer.openPopup();
    }
  });
}
