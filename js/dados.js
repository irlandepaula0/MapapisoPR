/* ============================================================
   DADOS.JS — Busca e Organização dos Dados
   ============================================================
   Este arquivo é o "departamento de pesquisa" do projeto.
   Ele cuida de:
   1. Buscar dados da planilha (via internet)
   2. Organizar os dados em formato útil
   3. Criar um "índice" para busca rápida

   PENSE ASSIM: se o projeto fosse uma biblioteca, este arquivo
   seria o funcionário que vai buscar os livros no depósito
   e organiza na estante para os leitores encontrarem fácil.
   ============================================================ */

// ============================================================
// VARIÁVEIS GLOBAIS (compartilhadas com outros arquivos)
// ============================================================
// municipios: lista completa de todos os municípios da pesquisa
// indice: "dicionário" onde a chave é o nome normalizado do município
//         e o valor é o objeto completo do município
//         Ex: indice["MARINGA"] = { municipio: "Maringá", ... }
//
// POR QUE O ÍNDICE É IMPORTANTE:
// Em vez de procurar um por um na lista (lento), o índice
// permite achar em UMA operação. É como ter um catálogo
// alfabético em vez de folhear todos os livros.
// ============================================================

let municipios = [];
let indice = {};

// metaDados: informações que vêm junto com a lista (quando o Apps Script
// devolve o formato "envelope"). Serve para mostrar no rodapé a hora da
// última sincronização — importante porque a planilha muda o tempo todo.
let metaDados = { atualizado: null, total: null };

// ============================================================
// carregarDados() — Busca os dados na planilha via internet
// ============================================================
// O QUE FAZ: Faz uma "requisição" (pedido) para a URL do
// Apps Script e recebe os dados em formato JSON.
//
// POR QUE USAR "async/await":
// Buscar dados na internet DEMORA (pode levar 1-3 segundos).
// Sem "await", o código continuaria executando sem os dados
// e daria erro. O "await" diz: "espera a resposta chegar
// antes de continuar".
//
// ANALOGIA: É como pedir comida no restaurante. Você faz
// o pedido (fetch), espera o pronto (await), e só depois
// come (usa os dados). Sem esperar, você tentaria comer
// o prato que ainda está na cozinha!
//
// ERROS POSSÍVEIS:
// - "HTTP 404": URL errada (página não existe)
// - "HTTP 403": sem permissão (bloqueado)
// - "erro desconhecido": planilha retornou mensagem de erro
// ============================================================

function comCacheBuster(url) {
  // A planilha é atualizada com frequência. Sem isto, o navegador (e a CDN
  // do Google) podem devolver a resposta anterior guardada em cache e o
  // usuário jura que "a alteração não subiu".
  const separador = url.indexOf("?") === -1 ? "?" : "&";
  return url + separador + "_ts=" + Date.now();
}

async function carregarDados() {
  const resposta = await fetch(comCacheBuster(API_URL), { cache: "no-store" });

  // res.ok = a resposta veio com sucesso (código 200)
  if (!resposta.ok) {
    throw new Error("HTTP " + resposta.status);
  }

  const corpo = await resposta.json();

  // Se a planilha retornar { ok: false, error: "..." }
  if (corpo && corpo.ok === false) {
    throw new Error(corpo.error || "erro desconhecido");
  }

  // Aceita tanto um array simples (formato padrão deste projeto)
  // quanto um objeto envelope { ok, total, municipios, atualizado }
  // (caso o Code.gs seja alterado no futuro para incluir metadados).
  // Isso evita que uma mudança de formato do lado da planilha quebre
  // o site inteiro sem aviso.
  if (Array.isArray(corpo)) {
    metaDados = { atualizado: null, total: corpo.length };
    return corpo;
  }
  if (corpo && Array.isArray(corpo.municipios)) {
    metaDados = {
      atualizado: corpo.atualizado || null,
      total: corpo.total || corpo.municipios.length
    };
    return corpo.municipios;
  }

  throw new Error("Formato de resposta inesperado da planilha.");
}

// ============================================================
// construirIndice(lista) — Cria o "catálogo" de busca rápida
// ============================================================
// O QUE FAZ: Percorre todos os municípios e cria um dicionário
// onde a chave é o nome normalizado (sem acento, maiúsculo).
//
// POR QUE É RÁPIDO:
// Procurar em uma lista de 400 itens: precisa checar um por um
// Procurar em um dicionário: o computador vai DIRETO ao item
//
// ANALOGIA: Lista = procurar um nome na lista telefônica
//                    folheando página por página
//           Índice = usar o índice alfabético no final do livro
//                    vai DIRETO na página certa
//
// ALIASES: Se o nome na planilha for diferente do nome oficial,
// usamos o ALIAS para apontar para o nome correto.
// ============================================================

function construirIndice(lista) {
  const idx = {};

  lista.forEach(function(municipio) {
    // Ignora registros sem nome (linhas vazias na planilha)
    if (!municipio || !municipio.municipio) {
      return;
    }

    // Normaliza o nome da planilha
    const chaveBase = normalizar(municipio.municipio);
    // Se tiver alias, usa o nome oficial; senão, usa o próprio
    const chaveOficial = ALIASES[chaveBase] || chaveBase;

    // Guarda no índice
    idx[chaveOficial] = municipio;
  });

  return idx;
}

// ============================================================
// corDoMunicipio(nomeGeoJSON) — Decide a cor do município no mapa
// ============================================================
// O QUE FAZ: Recebe o nome do município vindo do mapa (GeoJSON)
// e retorna: cor, classificação e os dados completos.
//
// RETORNO: objeto com 3 propriedades:
//   - cor: código da cor hexadecimal (ex: "#2ec4b6")
//   - classe: "paga", "nao_paga", "sem_dado" ou "fora_escopo"
//   - municipio: objeto completo do município (ou null)
//
// POR QUE RETORNAR TUDO JUNTO:
// Quem chama esta função (o mapa) precisa da cor para pintar,
// da classe para estatísticas, e dos dados para o popup.
// Em vez de chamar 3 funções separadas, retorna tudo de uma vez.
// ============================================================

function corDoMunicipio(nomeGeoJSON) {
  const chave = normalizar(nomeGeoJSON);
  const municipio = indice[chave];

  // Se não achou no índice, é "fora do escopo" (cinza)
  if (!municipio) {
    return {
      cor: CORES.fora_escopo,
      classe: "fora_escopo",
      municipio: null
    };
  }

  const classe = classificarMunicipio(municipio);
  return {
    cor: CORES[classe],
    classe: classe,
    municipio: municipio
  };
}
