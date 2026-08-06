/* ============================================================
   CONFIG.JS — Configurações do Projeto
   ============================================================
   Aqui ficam TODOS os valores que podem mudar:
   - URL da planilha de dados
   - Valores do piso nacional por ano
   - Lista de anos monitorados
   - Cores do mapa
   - Aliases (nomes alternativos de municípios)

   PENSE NISSO COMO O "MANUAL DE INSTRUÇÕES" do seu projeto.
   Quando alguém quiser adaptar para outro estado, vem aqui.
   ============================================================ */

// ============================================================
// URL DA PLANILHA (Google Apps Script)
// ============================================================
// IMPORTANTE: Substitua pela URL real do seu Apps Script!
// Veja o guia de implantação para saber como obter a URL.
//
// A URL tem formato assim:
// https://script.google.com/macros/s/AKfycb.../exec
//
// Você também pode passar via URL: ?api=SUA_URL
// ============================================================

const API_URL_PADRAO = "https://script.google.com/macros/s/AKfycbzAZG9L5heXDsiBXxLnstICtm7vuYzDnDY9u1L9oHXBDzVx5i1on9v01vI3oHpBHRLSPA/exec";

// Pega parâmetros da URL (ex: ?api=OUTRA_URL)
const _params = new URLSearchParams(window.location.search);
const API_URL = _params.get("api") || API_URL_PADRAO;

// Verifica se a URL foi configurada corretamente
const API_CONFIGURADA = !API_URL.includes("COLE_AQUI");

// ============================================================
// VALORES DO PISO NACIONAL DO MAGISTÉRIO
// ============================================================
// Fonte: Lei nº 11.738/2008 (atualizada anualmente)

const PISO_NACIONAL = {
  2022: 3845.63,
  2023: 4420.55,
  2024: 4580.57,
  2025: 4867.77,
  2026: 5130.63
};

const ANOS = [2022, 2023, 2024, 2025, 2026];

// ============================================================
// CORES DO MAPA
// ============================================================

const CORES = {
  paga:      "#2ec4b6",   // verde-água — cumpre o piso
  nao_paga:  "#a3312a",   // vermelho — não cumpre
  sem_dado:  "#d9b45f",   // âmbar — sem informação ainda
  fora_escopo: "#e0e0e0", // cinza claro — não acompanhado
};

// ============================================================
// ALIASES (NOMES ALTERNATIVOS DE MUNICÍPIOS)
// ============================================================
// PROBLEMA: O GeoJSON do IBGE usa nomes oficiais, mas sua
// planilha pode ter grafias diferentes.
//
// SOLUÇÃO: Traduzir nomes da planilha → nomes oficiais do IBGE
//
// EXEMPLOS ENCONTRADOS NA SUA PLANILHA:
//   "IPIRANGÁ" → "IPIRANGA" (sem acento final)
//   "JANIÓPOLIS" → "JANIOPOLIS" (sem acento)
//   "PARANAÍTY" → "PARANACITY" (nome diferente)
//   "IVAIPPORÃ" → "IVAIPORA" (sem acento)
//   "PINHALE DE SÃO BENTO" → "PINHALDESAOBENTO" (sem espaço)
//   "UMUARAMA-APOSENTADOS" → "UMUARAMA" (sem sufixo)
//
// IMPORTANTE: A chave é o nome NORMALIZADO (sem acento, maiúsculo,
// sem espaço). O valor é o nome OFICIAL no GeoJSON.
// ============================================================

const ALIASES = {
  // Nomes da planilha (normalizados) → Nomes oficiais do IBGE/GeoJSON
  // Lembre: normalizar() já remove acentos, espaços e hífens.
  // Só entram aqui os casos em que a GRAFIA é realmente diferente.
  "PINHALEDESAOBENTO": "PINHALDESAOBENTO",   // planilha: "PINHALE DE SÃO BENTO"
  "PARANAITY": "PARANACITY",                  // planilha: "PARANAÍTY"
  "IVAIPPORA": "IVAIPORA",                    // planilha: "IVAIPPORÃ"
  "JAGUAPIA": "JAGUAPITA",                    // planilha: "JAGUAPIÃ" → IBGE: Jaguapitã
  "UMUARAMAAPOSENTADOS": "UMUARAMA",          // planilha: "UMUARAMA-APOSENTADOS"
  "SANTOANTONIODAPLATINA": "SANTOANTONIODAPLATINA",
};

// ============================================================
// ANOS COM AUDITORIA DE FOLHA DE PAGAMENTO
// ============================================================
// A planilha tem uma coluna folha_AAAA_json por ano nesta lista
// (mais recente primeiro). Quando o usuário olha um ano sem
// auditoria de folha própria, o mapa usa a auditoria mais recente
// disponível ATÉ aquele ano — do mesmo jeito que já fazia com os
// dados legislativos (ver situacaoNoAnoOuAnterior em util.js).
// Pra adicionar um ano novo: criar a coluna na planilha, expor no
// Code.gs e incluir o ano aqui.
// ============================================================

const ANOS_FOLHA = [2025, 2024, 2023, 2022];

// ============================================================
// RÓTULOS DE SITUAÇÃO (usados nos filtros e no CSV)
// ============================================================

const ROTULOS_CLASSE = {
  paga: "Paga o piso",
  nao_paga: "Não paga o piso",
  sem_dado: "Sem dado levantado",
};
