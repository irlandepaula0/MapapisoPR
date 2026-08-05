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
// grupoGravidade(municipio) — Em que faixa de gravidade ele está
// ============================================================
// A tabela é uma LISTA DE TRABALHO, não um cadastro: o que exige
// providência aparece primeiro. As faixas, da mais grave para a
// menos grave:
//
//   0 — Perda apurada em folha de pagamento. É prova documental
//       de valor devido: é onde a atuação tem lastro mais forte.
//   1 — Sem auditoria de folha, mas a lei municipal já fixa
//       vencimento abaixo do piso. Indício forte, ainda sem
//       quantificação do prejuízo.
//   2 — Acompanhado, sem nenhum valor levantado ainda. É a fila
//       de pesquisa.
//   3 — Em conformidade (por folha auditada ou por lei).
//
// Dentro da faixa 0 a ordem é pelo valor perdido, do maior para
// o menor. Nas outras faixas, alfabética.
// ============================================================

function grupoGravidade(municipio) {
  const folha = municipio.folha_2025;

  if (folha && !folhaCumpre(folha)) {
    return 0;
  }
  if (folha && folhaCumpre(folha)) {
    return 3;
  }

  const classe = classificarMunicipio(municipio);
  if (classe === "nao_paga") return 1;
  if (classe === "sem_dado") return 2;
  return 3;
}

// Valor perdido apurado em folha. Zero quando não há auditoria —
// serve tanto para ordenar quanto para exibir na coluna.
function perdaApurada(municipio) {
  const folha = municipio && municipio.folha_2025;
  if (!folha) return null;
  const valor = Number(folha.total_perdido);
  return isNaN(valor) ? null : valor;
}

// ============================================================
// listaFiltrada() — Municípios do recorte atual, já ordenados
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

  lista.sort(function(a, b) {
    const ga = grupoGravidade(a);
    const gb = grupoGravidade(b);

    if (ga !== gb) return ga - gb;

    // Na faixa de perda apurada, o maior prejuízo vem primeiro
    if (ga === 0) {
      const pa = perdaApurada(a) || 0;
      const pb = perdaApurada(b) || 0;
      if (pa !== pb) return pb - pa;
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

  // Resumo do recorte: quantos municípios e quanto foi apurado neles
  const comPerda = lista.filter(function(m) {
    return m.folha_2025 && !folhaCumpre(m.folha_2025);
  });
  const perdaRecorte = comPerda.reduce(function(acc, m) {
    return acc + (perdaApurada(m) || 0);
  }, 0);

  let textoContagem = lista.length + (lista.length === 1 ? " município" : " municípios") +
    (houveFiltro ? " no recorte filtrado" : " acompanhados");

  if (comPerda.length > 0) {
    textoContagem += " · " + comPerda.length +
      (comPerda.length === 1 ? " com perda apurada" : " com perda apurada") +
      " somando " + fmt(perdaRecorte);
  }

  contagemEl.textContent = textoContagem;

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="vazio">' +
      "Nenhum município corresponde a este recorte. Limpe a busca ou troque os filtros." +
      "</td></tr>";
    return;
  }

  // Numeração da faixa mais grave: serve de ordem de prioridade
  let posicao = 0;

  tbody.innerHTML = lista.map(function(municipio) {
    const classe = classificarMunicipio(municipio);
    const ref = valorDeReferencia(municipio);
    const obs = observacaoResumida(municipio);
    const grupo = grupoGravidade(municipio);
    const perda = perdaApurada(municipio);

    let obsTexto = obs ? escHtml(obs) : "—";
    if (obs && obs.length > 190) {
      obsTexto = escHtml(obs.slice(0, 190)) + "…";
    }

    const pisoComparado = ref.ano ? pisoDoAno(ref.ano) : pisoAno;

    // --- Coluna de ordem de prioridade ---
    let celulaPos;
    if (grupo === 0) {
      posicao++;
      celulaPos = '<td class="pos-cell"><span class="pos-num">' +
        String(posicao).padStart(2, "0") + "</span></td>";
    } else {
      celulaPos = '<td class="pos-cell"></td>';
    }

    // --- Coluna de perda apurada, com a barra de proporção ---
    let celulaPerda;
    if (municipio.folha_2025 && perda !== null && perda > 0) {
      const prop = proporcaoIrregular(municipio);
      const pct = prop * 100;
      const pctTexto = pct >= 10
        ? Math.round(pct) + "%"
        : pct.toFixed(1).replace(".", ",") + "%";
      const largura = prop > 0 ? Math.max(pct, 1.5) : 0;
      const atraso = String(municipio.folha_2025.situacao || "").indexOf("ATRASO") !== -1;

      celulaPerda =
        '<td class="valor-cell perda-cell">' +
          '<b class="perda-valor">' + fmt(perda) + "</b>" +
          '<span class="faixa-trilha" title="' + pctTexto +
            ' dos lançamentos de folha ficaram abaixo do piso">' +
            '<span class="faixa-preench' + (atraso ? " atraso" : "") +
              '" style="width:' + largura + '%"></span>' +
          "</span>" +
          '<span class="faixa-lbl">' + pctTexto + " dos lançamentos</span>" +
        "</td>";
    } else if (municipio.folha_2025) {
      celulaPerda = '<td class="valor-cell perda-cell"><b class="perda-zero">' +
        fmt(0) + "</b><span class=\"faixa-lbl\">folha em conformidade</span></td>";
    } else {
      celulaPerda = '<td class="valor-cell perda-cell"><span class="sem-auditoria">' +
        "sem auditoria de folha</span></td>";
    }

    // --- Coluna de profissionais atingidos ---
    const professores = municipio.folha_2025
      ? Number(municipio.folha_2025.professores_afetados) || 0
      : null;
    const celulaProf = '<td class="valor-cell">' +
      (professores === null ? '<span class="sem-auditoria">—</span>'
                            : professores.toLocaleString("pt-BR")) +
      "</td>";

    return (
      '<tr data-municipio="' + escHtml(municipio.municipio) + '"' +
        (grupo === 0 ? ' class="linha-grave"' : "") + ">" +
        celulaPos +
        '<td class="mun-cell"><b>' + escHtml(municipio.municipio) + "</b>" +
          '<span class="mun-sub">' + escHtml(municipio.nucleo || "") +
          (municipio.populacao
            ? " · " + Number(municipio.populacao).toLocaleString("pt-BR") + " hab."
            : "") +
          "</span></td>" +
        "<td>" + classeBadgeHTML(classe) + "</td>" +
        celulaPerda +
        celulaProf +
        '<td class="valor-cell">' + ref.texto +
          '<span class="nota-ano">' + ref.nota + "</span>" +
          '<span class="dif-linha">' + fmtDif(ref.diferenca) +
            ' <span class="piso-ref">vs. ' + fmt(pisoComparado) + "</span></span>" +
        "</td>" +
        '<td class="obs-cell">' + obsTexto + "</td>" +
      "</tr>"
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
    "Ordem de prioridade", "Município", "Núcleo", "Prioridade", "Situação",
    "Perda apurada em folha (R$)", "Profissionais atingidos",
    "Lançamentos de folha", "Lançamentos abaixo do piso", "% abaixo do piso",
    "Ano do valor", "Valor praticado", "Piso do ano", "Diferença",
    "População", "PCCR", "Observação"
  ];

  let posicao = 0;

  const linhas = lista.map(function(municipio) {
    const ref = valorDeReferencia(municipio);
    const pisoComparado = ref.ano ? pisoDoAno(ref.ano) : pisoDoAno(anoSelecionado);
    const folha = municipio.folha_2025;
    const perda = perdaApurada(municipio);

    if (grupoGravidade(municipio) === 0) posicao++;

    const registros = folha ? Number(folha.total_registros) || 0 : null;
    const desc = folha ? Number(folha.registros_descumprimento) || 0 : null;
    const pct = registros ? (desc / registros) * 100 : null;

    return [
      grupoGravidade(municipio) === 0 ? posicao : "",
      municipio.municipio,
      municipio.nucleo || "",
      municipio.prioridade || "",
      ROTULOS_CLASSE[classificarMunicipio(municipio)] || "",
      perda === null ? "" : perda.toFixed(2).replace(".", ","),
      folha ? (Number(folha.professores_afetados) || 0) : "",
      registros === null ? "" : registros,
      desc === null ? "" : desc,
      pct === null ? "" : pct.toFixed(2).replace(".", ","),
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
