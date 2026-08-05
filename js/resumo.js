/* ============================================================
   RESUMO.JS — Tabela de resumo dos municípios
   ============================================================
   Este arquivo cuida da tabela que aparece ABAIXO do mapa.
   Ele faz:
   1. Aplica os filtros (busca, núcleo, situação)
   2. Ordena os municípios (problema primeiro, sem dado, depois OK)
   3. Mostra lado a lado o VALOR PRATICADO e o PISO do ano
   4. Monta o balão (popup) que aparece ao clicar no mapa
   5. Exporta o recorte em tela para CSV

   PENSE ASSIM: se o mapa é um "quadro de avisos", a tabela
   é uma "lista telefônica" — ambos mostram os mesmos dados,
   mas de formas diferentes para necessidades diferentes.
   ============================================================ */

// ============================================================
// situacaoBadgeHTML(situacao) — Etiqueta colorida
// ============================================================
//   acima  → verde (paga mais que o mínimo legal)
//   igual  → azul (paga exatamente o piso)
//   abaixo → vermelho (problema! paga menos)
//   outros → cinza (sem informação)
// ============================================================

function situacaoBadgeHTML(situacao) {
  const mapa = {
    acima:  { bg: "var(--ok-bg)",    c: "var(--ok)",    t: "acima do piso" },
    igual:  { bg: "var(--igual-bg)", c: "var(--igual)", t: "igual ao piso" },
    abaixo: { bg: "var(--err-bg)",   c: "var(--err)",   t: "abaixo do piso" },
  };

  const config = mapa[situacao] || { bg: "var(--pend-bg)", c: "var(--pend)", t: "sem dado" };

  return `<span class="pill" style="color:${config.c};background:${config.bg}">${config.t}</span>`;
}

// ============================================================
// classeBadgeHTML(classe) — Etiqueta da classificação final
// ============================================================
// DIFERENÇA de situacaoBadgeHTML:
// - situacaoBadgeHTML: "acima/igual/abaixo" (comparação numérica)
// - classeBadgeHTML: "Paga o piso / Não paga" (conclusão final)
// ============================================================

function classeBadgeHTML(classe) {
  const mapa = {
    paga:     { bg: "var(--ok-bg)",   c: "var(--ok)",   t: "✓ Paga o piso do magistério" },
    nao_paga: { bg: "var(--err-bg)",  c: "var(--err)",  t: "Não vem pagando o piso integralmente" },
    sem_dado: { bg: "var(--warn-bg)", c: "var(--warn)", t: "Acompanhado — ainda sem dado levantado" },
  };

  const config = mapa[classe];
  if (!config) return "";

  return `<span class="pill" style="color:${config.c};background:${config.bg}">${config.t}</span>`;
}

// ============================================================
// conteudoPopup(municipio) — HTML do balão ao clicar no mapa
// ============================================================
// ESTRUTURA:
// 1. Nome do município
// 2. Núcleo, prioridade, população
// 3. Classificação final
// 4. Piso do ano × valor praticado × diferença
// 5. Auditoria de folha de pagamento (quando houver)
// 6. PCCR
// 7. Observações gerais
// 8. Histórico ano a ano, com link para a lei
// ============================================================

function conteudoPopup(municipio) {
  if (!municipio) {
    return `
      <div class="popup-body">
        <h3>Fora do escopo</h3>
        <p class="sub">Este município ainda não está na lista de acompanhamento desta pesquisa.</p>
      </div>
    `;
  }

  const classe = classificarMunicipio(municipio);

  // --- Piso praticado no ano em tela ---
  const info = situacaoNoAnoOuAnterior(municipio, anoSelecionado);
  let blocoPiso;

  if (!info) {
    blocoPiso = `
      <div class="piso-box">
        <div class="piso-linha"><span>Piso nacional ${anoSelecionado}</span><b>${fmt(pisoDoAno(anoSelecionado))}</b></div>
        <div class="piso-linha"><span>Praticado pelo município</span><b style="color:var(--ink-dim)">sem valor levantado</b></div>
      </div>
    `;
  } else {
    const nota = info.ano !== anoSelecionado
      ? `<div class="detalhe-discreto">Último valor disponível: ${info.ano}. A comparação usa o piso desse mesmo ano.</div>`
      : "";
    blocoPiso = `
      <div class="piso-box">
        <div class="piso-linha"><span>Piso nacional ${info.ano}</span><b>${fmt(pisoDoAno(info.ano))}</b></div>
        <div class="piso-linha"><span>Praticado pelo município</span><b>${fmt(info.valor)}</b></div>
        <div class="piso-linha"><span>Diferença</span><b>${fmtDif(diferencaParaPiso(info.valor, info.ano))}</b></div>
        ${nota}
      </div>
    `;
  }

  // --- Histórico ano a ano ---
  let linhasAnos = "";
  ANOS.forEach(function(ano) {
    const dado = municipio.anos && municipio.anos[ano];

    if (!dado || !dado.valor) {
      linhasAnos += `<tr><td>${ano}</td><td colspan="2" style="color:var(--ink-dim)">sem dado</td></tr>`;
      return;
    }

    const sit = dado.situacao || situacaoAuto(dado.valor, ano);
    const linkLei = dado.url
      ? ` <a class="fonte-link" href="${escHtml(dado.url)}" target="_blank" rel="noreferrer" title="abrir a lei">↗</a>`
      : "";

    linhasAnos += `
      <tr>
        <td>${ano}${linkLei}</td>
        <td>${fmt(dado.valor)}</td>
        <td>${situacaoBadgeHTML(sit)}</td>
      </tr>
    `;
  });

  // --- Auditoria de folha de pagamento ---
  let blocoFolha = "";
  if (municipio.folha_2025) {
    const folha = municipio.folha_2025;
    const cumpre = folhaCumpre(folha);
    const corFundo = cumpre ? "var(--ok-bg)" : "var(--warn-bg)";

    const detalhes = [];
    if (folha.professores_afetados) {
      detalhes.push(folha.professores_afetados + " professores em situação identificada");
    }
    if (folha.total_perdido) {
      detalhes.push(fmt(folha.total_perdido) + " em diferenças no ano");
    }

    blocoFolha = `
      <div class="obs-box" style="background:${corFundo};">
        <b>Folha de pagamento ${ANO_FOLHA}:</b>
        ${escHtml(folha.observacoes || folha.situacao || "")}
        ${detalhes.length ? `<div class="detalhe-discreto">${escHtml(detalhes.join(" · "))}</div>` : ""}
      </div>
    `;
  }

  // --- PCCR ---
  let blocoPCCR;
  if (municipio.pccr && municipio.pccr.lei) {
    const linkLei = municipio.pccr.url
      ? ` — <a class="fonte-link" href="${escHtml(municipio.pccr.url)}" target="_blank" rel="noreferrer">↗ abrir lei</a>`
      : "";
    blocoPCCR = `<p style="margin:6px 0 4px"><b>PCCR:</b> ${escHtml(municipio.pccr.lei)}${linkLei}</p>`;
  } else {
    blocoPCCR = `<p style="margin:6px 0 4px;color:var(--ink-dim)">PCCR ainda não identificado.</p>`;
  }

  // --- Observações gerais ---
  let blocoObs = "";
  if (municipio.obs_geral) {
    blocoObs = `<div class="obs-box" style="background:var(--paper-dim);">📝 ${escHtml(municipio.obs_geral)}</div>`;
  }

  return `
    <div class="popup-body">
      <h3>📍 ${escHtml(municipio.municipio)}</h3>
      <p class="sub">
        ${escHtml(municipio.nucleo)} · ${escHtml(municipio.prioridade)}
        ${municipio.populacao ? " · " + municipio.populacao.toLocaleString("pt-BR") + " hab." : ""}
      </p>
      <div style="margin-bottom:8px;">${classeBadgeHTML(classe)}</div>
      ${blocoPiso}
      ${blocoFolha}
      ${blocoPCCR}
      ${blocoObs}
      <table class="anos-mini">
        <thead><tr><th>Ano</th><th>Praticado</th><th>Situação</th></tr></thead>
        <tbody>${linhasAnos}</tbody>
      </table>
    </div>
  `;
}

// ============================================================
// valorDeReferencia(municipio) — Valor praticado mais recente
// ============================================================
// RETORNO: { texto, nota, valor, ano, diferenca }
// A nota aparece quando o dado é de um ano anterior ao selecionado.
// ============================================================

function valorDeReferencia(municipio) {
  const info = situacaoNoAnoOuAnterior(municipio, anoSelecionado);

  if (!info) {
    return { texto: "—", nota: "", valor: null, ano: null, diferenca: null };
  }

  return {
    texto: fmt(info.valor),
    nota: info.ano !== anoSelecionado ? "(dado de " + info.ano + ")" : "",
    valor: info.valor,
    ano: info.ano,
    diferenca: diferencaParaPiso(info.valor, info.ano)
  };
}

// ============================================================
// observacaoResumida(municipio) — Observação curta para a tabela
// ============================================================
// PRIORIDADE:
// 1. Auditoria de folha de pagamento (mais recente e mais forte)
// 2. Observação geral do município
// 3. Observação do PCCR
// ============================================================

function observacaoResumida(municipio) {
  if (municipio.folha_2025 && municipio.folha_2025.observacoes) {
    return municipio.folha_2025.observacoes;
  }
  if (municipio.obs_geral) {
    return municipio.obs_geral;
  }
  if (municipio.pccr && municipio.pccr.obs) {
    return municipio.pccr.obs;
  }
  return "";
}

// ============================================================
// passaFiltros(municipio) — Regra única de filtragem
// ============================================================
// POR QUE UMA FUNÇÃO SÓ:
// Mapa, tabela e CSV precisam concordar entre si. Se cada um
// tivesse sua própria regra, um filtro mostraria 30 municípios
// na tabela e 45 no mapa — e ninguém confiaria mais no número.
// ============================================================

function passaFiltros(municipio) {
  if (!municipio) return false;

  if (filtroNucleo && municipio.nucleo !== filtroNucleo) {
    return false;
  }

  if (filtroSituacao && classificarMunicipio(municipio) !== filtroSituacao) {
    return false;
  }

  if (filtroBusca) {
    const alvo = normalizar(municipio.municipio + " " + (municipio.nucleo || ""));
    if (alvo.indexOf(normalizar(filtroBusca)) === -1) {
      return false;
    }
  }

  return true;
}

// ============================================================
// listaFiltrada() — Municípios do recorte atual, já ordenados
// ============================================================
// ORDEM: problema (0) → sem dado (1) → OK (2), alfabética dentro
// de cada grupo. Quem usa a ferramenta quer ver os PROBLEMAS
// primeiro: é uma lista de trabalho, não um cadastro.
// ============================================================

function listaFiltrada() {
  const vistos = {};
  const lista = [];

  Object.keys(indice).forEach(function(chave) {
    const municipio = indice[chave];

    // Evita duplicar quando dois aliases apontam pro mesmo município.
    // A identidade usa o nome normalizado como reserva, porque o id
    // pode vir vazio em linhas novas da planilha.
    const identidade = municipio.id || normalizar(municipio.municipio);
    if (vistos[identidade]) return;
    vistos[identidade] = true;

    if (!passaFiltros(municipio)) return;

    lista.push(municipio);
  });

  const ordemClasse = { nao_paga: 0, sem_dado: 1, paga: 2 };

  lista.sort(function(a, b) {
    const ca = classificarMunicipio(a);
    const cb = classificarMunicipio(b);

    if (ordemClasse[ca] !== ordemClasse[cb]) {
      return ordemClasse[ca] - ordemClasse[cb];
    }
    return a.municipio.localeCompare(b.municipio, "pt-BR");
  });

  return lista;
}

// ============================================================
// renderResumo() — Desenha a tabela completa
// ============================================================

function renderResumo() {
  const tbody = document.getElementById("resumo-tbody");
  const contagemEl = document.getElementById("resumo-contagem");

  const lista = listaFiltrada();
  const pisoAno = pisoDoAno(anoSelecionado);
  const houveFiltro = Boolean(filtroBusca || filtroNucleo || filtroSituacao);

  const textoContagem = lista.length === 1
    ? "1 município no recorte"
    : lista.length + " municípios no recorte";

  contagemEl.textContent = textoContagem +
    (houveFiltro ? " (filtrado)" : "") +
    " · piso nacional " + anoSelecionado + ": " + fmt(pisoAno);

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="vazio">' +
      "Nenhum município corresponde a este recorte. Limpe a busca ou troque os filtros." +
      "</td></tr>";
    return;
  }

  tbody.innerHTML = lista.map(function(municipio) {
    const classe = classificarMunicipio(municipio);
    const ref = valorDeReferencia(municipio);
    const obs = observacaoResumida(municipio);

    let obsTexto = obs ? escHtml(obs) : "—";
    if (obs && obs.length > 160) {
      obsTexto = escHtml(obs.slice(0, 160)) + "…";
    }

    const pisoComparado = ref.ano ? pisoDoAno(ref.ano) : pisoAno;

    return (
      '<tr data-municipio="' + escHtml(municipio.municipio) + '">' +
        '<td><b>' + escHtml(municipio.municipio) + '</b></td>' +
        '<td>' + escHtml(municipio.nucleo || "") + '</td>' +
        '<td>' + classeBadgeHTML(classe) + '</td>' +
        '<td class="valor-cell">' + ref.texto +
          ' <span class="nota-ano">' + ref.nota + '</span></td>' +
        '<td class="valor-cell piso-cell">' + fmt(pisoComparado) + '</td>' +
        '<td class="valor-cell">' + fmtDif(ref.diferenca) + '</td>' +
        '<td class="obs-cell">' + obsTexto + '</td>' +
      '</tr>'
    );
  }).join("");

  // Clique na linha leva ao município no mapa
  tbody.querySelectorAll("tr[data-municipio]").forEach(function(linha) {
    linha.addEventListener("click", function() {
      centralizarNoMunicipio(linha.getAttribute("data-municipio"));
    });
  });
}

// ============================================================
// baixarCSV() — Exporta o recorte em tela
// ============================================================
// POR QUE ";" E O MARCADOR "\ufeff":
// O Excel em português espera ponto e vírgula como separador de
// colunas e precisa do marcador BOM no início do arquivo para
// reconhecer os acentos. Sem isso, "Maringá" vira "MaringÃ¡".
// ============================================================

function baixarCSV() {
  const lista = listaFiltrada();

  const cabecalho = [
    "Município", "Núcleo", "Prioridade", "Situação",
    "Ano do valor", "Valor praticado", "Piso do ano", "Diferença",
    "População", "PCCR", "Observação"
  ];

  const linhas = lista.map(function(municipio) {
    const ref = valorDeReferencia(municipio);
    const pisoComparado = ref.ano ? pisoDoAno(ref.ano) : pisoDoAno(anoSelecionado);

    return [
      municipio.municipio,
      municipio.nucleo || "",
      municipio.prioridade || "",
      ROTULOS_CLASSE[classificarMunicipio(municipio)] || "",
      ref.ano || "",
      ref.valor === null ? "" : ref.valor.toFixed(2).replace(".", ","),
      pisoComparado === null ? "" : pisoComparado.toFixed(2).replace(".", ","),
      ref.diferenca === null ? "" : ref.diferenca.toFixed(2).replace(".", ","),
      municipio.populacao || "",
      (municipio.pccr && municipio.pccr.lei) || "",
      observacaoResumida(municipio)
    ];
  });

  const csv = [cabecalho].concat(linhas).map(function(colunas) {
    return colunas.map(function(celula) {
      return '"' + String(celula).replace(/"/g, '""').replace(/\r?\n/g, " ") + '"';
    }).join(";");
  }).join("\r\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "piso-magisterio-pr-" + anoSelecionado + ".csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
