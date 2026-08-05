/* ============================================================
   GRAFICOS.JS — Painel de perdas e gráficos de visualização
   ============================================================
   Este arquivo desenha os números e os gráficos da perda
   apurada. Ele NÃO usa nenhuma biblioteca de gráficos: monta
   SVG na mão.

   POR QUE SVG NA MÃO, SEM BIBLIOTECA:
   1. Zero dependência externa — nada para falhar ao carregar,
      nada que fique fora do ar por conta de uma CDN.
   2. Fica nítido em qualquer zoom e imprime bem — importante
      para um material que vai virar anexo de documento.
   3. As cores e a tipografia saem do mesmo CSS do resto do
      site, então o gráfico não parece "colado" de outro lugar.

   TUDO AQUI RESPEITA OS FILTROS de núcleo e busca. Se a pessoa
   filtrar pelo núcleo de Guarapuava, os gráficos passam a
   mostrar apenas aquele núcleo.
   ============================================================ */

// ============================================================
// PALETA DOS GRÁFICOS
// ============================================================
// Reaproveita as cores de situação já usadas no mapa, para que
// vermelho signifique a mesma coisa no mapa e no gráfico.
// ============================================================

const COR_GRAFICO = {
  descumpre: "#a3312a",   // mesma cor de "não paga" do mapa
  atraso:    "#b5651d",   // âmbar: corrigiu no meio do ano
  cumpre:    "#2f6b3a",
  neutro:    "#1c2b3a",   // azul-processo, para contagens
  trilha:    "#e8e2d6"    // fundo da barra
};

// ============================================================
// listaAuditada() — Municípios com auditoria de folha
// ============================================================
// Aplica os filtros de NÚCLEO e BUSCA, mas de propósito NÃO
// aplica o filtro de situação nem o de ano.
//
// POR QUE IGNORAR O ANO: a auditoria de folha é de um exercício
// fechado (2025). Se ela desaparecesse ao escolher 2022 no
// seletor, o painel de perdas piscaria para zero e daria a
// impressão de que o dado sumiu. O ano do levantamento fica
// escrito no título de cada gráfico.
// ============================================================

function listaAuditada() {
  const vistos = {};
  const lista = [];

  Object.keys(indice).forEach(function(chave) {
    const municipio = indice[chave];
    if (!municipio || !municipio.folha_2025) return;

    const identidade = municipio.id || normalizar(municipio.municipio);
    if (vistos[identidade]) return;
    vistos[identidade] = true;

    // Filtro de núcleo
    if (filtroNucleo && municipio.nucleo !== filtroNucleo) return;

    // Filtro de busca
    if (filtroBusca) {
      const alvo = normalizar(municipio.municipio + " " + (municipio.nucleo || ""));
      if (alvo.indexOf(normalizar(filtroBusca)) === -1) return;
    }

    lista.push(municipio);
  });

  return lista;
}

// ============================================================
// perdaDe(municipio) / professoresDe(municipio)
// ============================================================
// Leitura defensiva dos campos da auditoria: se a planilha vier
// com o campo faltando, devolve 0 em vez de quebrar a página.
// ============================================================

function perdaDe(municipio) {
  const f = municipio && municipio.folha_2025;
  if (!f) return 0;
  const v = Number(f.total_perdido);
  return isNaN(v) ? 0 : v;
}

function professoresDe(municipio) {
  const f = municipio && municipio.folha_2025;
  if (!f) return 0;
  const v = Number(f.professores_afetados);
  return isNaN(v) ? 0 : v;
}

function registrosDe(municipio) {
  const f = municipio && municipio.folha_2025;
  if (!f) return 0;
  const v = Number(f.total_registros);
  return isNaN(v) ? 0 : v;
}

function descumprimentosDe(municipio) {
  const f = municipio && municipio.folha_2025;
  if (!f) return 0;
  const v = Number(f.registros_descumprimento);
  return isNaN(v) ? 0 : v;
}

// Proporção dos lançamentos de folha que ficaram abaixo do piso.
// É o indicador que separa defasagem estrutural da tabela de
// vencimentos (proporção alta) de falha pontual em poucos
// contratos (proporção baixa).
function proporcaoIrregular(municipio) {
  const reg = registrosDe(municipio);
  if (!reg) return 0;
  return descumprimentosDe(municipio) / reg;
}

// ============================================================
// fmtCurto(valor) — Dinheiro em forma compacta
// ============================================================
// Rótulo de gráfico não cabe "R$ 5.540.237,20". Vira "R$ 5,5 mi".
// O valor exato continua disponível na tabela e no CSV.
// ============================================================

function fmtCurto(valor) {
  const v = Number(valor) || 0;
  if (v >= 1000000) {
    return "R$ " + (v / 1000000).toLocaleString("pt-BR", {
      minimumFractionDigits: 1, maximumFractionDigits: 1
    }) + " mi";
  }
  if (v >= 1000) {
    return "R$ " + Math.round(v / 1000).toLocaleString("pt-BR") + " mil";
  }
  return fmt(v);
}

function fmtInteiro(valor) {
  return Number(valor || 0).toLocaleString("pt-BR");
}

// ============================================================
// PAINEL DE PERDAS — os números grandes
// ============================================================

function renderPainelPerdas() {
  const alvo = document.getElementById("painel-perdas");
  if (!alvo) return;

  const lista = listaAuditada();

  if (lista.length === 0) {
    alvo.innerHTML = '<p class="painel-vazio">Nenhum município com auditoria de folha de pagamento neste recorte. ' +
      'Limpe os filtros para ver o levantamento completo.</p>';
    return;
  }

  let perdaTotal = 0, professoresTotal = 0, registrosTotal = 0, descTotal = 0;
  let comPerda = 0, cumprem = 0;

  lista.forEach(function(m) {
    perdaTotal += perdaDe(m);
    professoresTotal += professoresDe(m);
    registrosTotal += registrosDe(m);
    descTotal += descumprimentosDe(m);
    if (folhaCumpre(m.folha_2025)) cumprem++;
    else comPerda++;
  });

  const mediaPorProfessor = professoresTotal > 0 ? perdaTotal / professoresTotal : 0;

  const cartoes = [
    {
      valor: fmtCurto(perdaTotal),
      exato: fmt(perdaTotal),
      rotulo: "deixado de pagar ao magistério no exercício",
      nota: "soma das diferenças, lançamento por lançamento",
      forte: true
    },
    {
      valor: fmtInteiro(professoresTotal),
      rotulo: "profissionais atingidos em ao menos um mês",
      nota: "contagem por pessoa, sem repetição"
    },
    {
      valor: fmt(mediaPorProfessor),
      rotulo: "perda média por profissional atingido",
      nota: "no acumulado do exercício"
    },
    {
      valor: comPerda + " de " + lista.length,
      rotulo: "municípios auditados com pagamento abaixo do piso",
      nota: cumprem === 0
        ? "nenhum cumpriu integralmente"
        : cumprem + (cumprem === 1 ? " cumpriu" : " cumpriram") + " integralmente"
    }
  ];

  alvo.innerHTML = cartoes.map(function(c) {
    return '<div class="perda-card' + (c.forte ? " forte" : "") + '">' +
             '<b' + (c.exato ? ' title="' + escHtml(c.exato) + '"' : "") + '>' + c.valor + "</b>" +
             '<div class="perda-rot">' + c.rotulo + "</div>" +
             '<div class="perda-nota">' + c.nota + "</div>" +
           "</div>";
  }).join("");
}

// ============================================================
// barrasHorizontais(config) — Gerador genérico de gráfico
// ============================================================
// Um único gerador serve para todos os gráficos de barra da
// página. Recebe:
//   itens:    [{ rotulo, valor, cor, sufixo }]
//   formatar: função que transforma o valor em texto
//   unidade:  descrição da grandeza (vai no aria-label)
//
// COMO A LARGURA É CALCULADA:
// A barra mais longa ocupa 100% da área disponível e as outras
// são proporcionais a ela. Assim a comparação é sempre visual,
// sem precisar ler os números.
// ============================================================

function barrasHorizontais(config) {
  const itens = config.itens || [];
  if (itens.length === 0) {
    return '<p class="grafico-vazio">Sem dados para este recorte.</p>';
  }

  const formatar = config.formatar || fmtCurto;

  // Geometria em unidades do viewBox (o SVG escala sozinho na tela)
  const LARG = 820;
  const ALT_LINHA = 28;
  const TOPO = 6;
  const COL_ROTULO = config.colRotulo || 186;   // nome do município
  // Quando o item traz sufixo ("· 3 municípios"), o texto da direita é
  // mais longo e precisa de mais espaço reservado — senão vaza do SVG.
  const COL_VALOR = config.colValor || 104;
  const AREA_BARRA = LARG - COL_ROTULO - COL_VALOR - 14;
  const ALT_BARRA = 13;

  const maior = itens.reduce(function(acc, it) {
    return Math.max(acc, Number(it.valor) || 0);
  }, 0) || 1;

  const altura = TOPO + itens.length * ALT_LINHA + 4;

  let corpo = "";

  itens.forEach(function(it, i) {
    const y = TOPO + i * ALT_LINHA;
    const valor = Number(it.valor) || 0;
    // Barras muito pequenas ganham 2px para não desaparecerem
    const larguraBarra = valor > 0
      ? Math.max((valor / maior) * AREA_BARRA, 2)
      : 0;

    // Nome longo é cortado: texto em SVG não quebra linha sozinho
    let rotulo = it.rotulo || "";
    if (rotulo.length > 25) rotulo = rotulo.slice(0, 24) + "…";

    corpo +=
      '<text class="g-rotulo" x="' + (COL_ROTULO - 10) + '" y="' + (y + ALT_BARRA - 1) +
        '" text-anchor="end">' + escHtml(rotulo) + "</text>" +
      '<rect class="g-trilha" x="' + COL_ROTULO + '" y="' + y +
        '" width="' + AREA_BARRA + '" height="' + ALT_BARRA + '" rx="1"/>' +
      '<rect x="' + COL_ROTULO + '" y="' + y +
        '" width="' + larguraBarra + '" height="' + ALT_BARRA +
        '" rx="1" fill="' + (it.cor || COR_GRAFICO.neutro) + '"/>' +
      '<text class="g-valor" x="' + (COL_ROTULO + AREA_BARRA + 12) + '" y="' + (y + ALT_BARRA - 1) + '">' +
        escHtml(formatar(valor)) + (it.sufixo ? '<tspan class="g-sufixo"> ' + escHtml(it.sufixo) + "</tspan>" : "") +
      "</text>";
  });

  return '<svg class="grafico" viewBox="0 0 ' + LARG + " " + altura +
    '" role="img" aria-label="' + escHtml(config.descricao || "gráfico de barras") + '">' +
    corpo + "</svg>";
}

// ============================================================
// GRÁFICO 1 — Perda apurada por município
// ============================================================

function graficoPerdaPorMunicipio(lista) {
  const itens = lista
    .slice()
    .sort(function(a, b) { return perdaDe(b) - perdaDe(a); })
    .filter(function(m) { return perdaDe(m) > 0; })
    .map(function(m) {
      const atraso = String((m.folha_2025 && m.folha_2025.situacao) || "").indexOf("ATRASO") !== -1;
      return {
        rotulo: m.municipio,
        valor: perdaDe(m),
        cor: atraso ? COR_GRAFICO.atraso : COR_GRAFICO.descumpre
      };
    });

  return barrasHorizontais({
    itens: itens,
    formatar: fmtCurto,
    descricao: "Perda apurada por município, em reais, do maior para o menor"
  });
}

// ============================================================
// GRÁFICO 2 — Profissionais atingidos por município
// ============================================================

function graficoProfessoresPorMunicipio(lista) {
  const itens = lista
    .slice()
    .sort(function(a, b) { return professoresDe(b) - professoresDe(a); })
    .filter(function(m) { return professoresDe(m) > 0; })
    .map(function(m) {
      return {
        rotulo: m.municipio,
        valor: professoresDe(m),
        cor: COR_GRAFICO.neutro
      };
    });

  return barrasHorizontais({
    itens: itens,
    formatar: fmtInteiro,
    descricao: "Número de profissionais do magistério atingidos por município"
  });
}

// ============================================================
// GRÁFICO 3 — Perda média por profissional atingido
// ============================================================
// POR QUE ESTE GRÁFICO IMPORTA:
// O total perdido esconde duas realidades muito diferentes.
// Um município pode ter perda alta porque atinge muita gente
// (Guarapuava), outro porque atinge pouca gente mas de forma
// muito severa. Este gráfico mostra o tamanho do prejuízo
// INDIVIDUAL — que é o que interessa numa ação por professor.
// ============================================================

function graficoPerdaPorProfessor(lista) {
  const itens = lista
    .filter(function(m) { return professoresDe(m) > 0 && perdaDe(m) > 0; })
    .map(function(m) {
      return {
        rotulo: m.municipio,
        valor: perdaDe(m) / professoresDe(m),
        cor: COR_GRAFICO.descumpre
      };
    })
    .sort(function(a, b) { return b.valor - a.valor; });

  return barrasHorizontais({
    itens: itens,
    formatar: fmt,
    descricao: "Perda média por profissional atingido, em reais, do maior para o menor"
  });
}

// ============================================================
// GRÁFICO 4 — Perda somada por núcleo sindical
// ============================================================
// Agrega os municípios pelo núcleo a que pertencem. Serve para
// a direção decidir onde concentrar esforço: um núcleo com dois
// municípios muito defasados pode pesar mais que outro com dez
// municípios levemente defasados.
// ============================================================

function graficoPerdaPorNucleo(lista) {
  const porNucleo = {};

  lista.forEach(function(m) {
    const nucleo = m.nucleo || "(sem núcleo)";
    if (!porNucleo[nucleo]) {
      porNucleo[nucleo] = { perda: 0, professores: 0, municipios: 0 };
    }
    porNucleo[nucleo].perda += perdaDe(m);
    porNucleo[nucleo].professores += professoresDe(m);
    porNucleo[nucleo].municipios++;
  });

  const itens = Object.keys(porNucleo)
    .map(function(nucleo) {
      const d = porNucleo[nucleo];
      return {
        rotulo: nucleo,
        valor: d.perda,
        cor: COR_GRAFICO.descumpre,
        sufixo: "· " + d.municipios + (d.municipios === 1 ? " município" : " municípios")
      };
    })
    .filter(function(it) { return it.valor > 0; })
    .sort(function(a, b) { return b.valor - a.valor; });

  return barrasHorizontais({
    itens: itens,
    formatar: fmtCurto,
    // Coluna da direita mais larga: aqui o texto leva o sufixo com a
    // contagem de municípios ("R$ 5,5 mi · 3 municípios").
    colValor: 178,
    descricao: "Perda apurada somada por núcleo sindical"
  });
}

// ============================================================
// renderGraficos() — Monta a seção inteira
// ============================================================
// Cada gráfico vem com um título e uma frase explicando o que
// ele mostra. Gráfico sem legenda de leitura vira enfeite; com
// legenda, vira argumento.
// ============================================================

function renderGraficos() {
  const alvo = document.getElementById("graficos");
  if (!alvo) return;

  const lista = listaAuditada();

  if (lista.length === 0) {
    alvo.innerHTML = '<p class="grafico-vazio">Nenhum município com auditoria de folha neste recorte.</p>';
    return;
  }

  const blocos = [
    {
      titulo: "Perda apurada por município",
      desc: "Valor que deixou de ser pago ao magistério em cada município no exercício. " +
            "As barras em âmbar são de municípios que corrigiram os valores no meio do ano — " +
            "a diferença do período anterior à correção continua devida.",
      svg: graficoPerdaPorMunicipio(lista)
    },
    {
      titulo: "Profissionais atingidos por município",
      desc: "Quantas pessoas receberam abaixo do piso em pelo menos um mês. " +
            "Cada profissional é contado uma única vez, ainda que atingido em vários meses.",
      svg: graficoProfessoresPorMunicipio(lista)
    },
    {
      titulo: "Perda média por profissional atingido",
      desc: "O total perdido esconde realidades distintas: há municípios onde muita gente perde pouco " +
            "e municípios onde pouca gente perde muito. Esta é a dimensão individual do prejuízo — " +
            "a que importa quando se avalia reclamação por profissional.",
      svg: graficoPerdaPorProfessor(lista)
    },
    {
      titulo: "Perda somada por núcleo sindical",
      desc: "Agrupamento pelos núcleos do sindicato, para orientar onde concentrar a atuação.",
      svg: graficoPerdaPorNucleo(lista)
    }
  ];

  alvo.innerHTML = blocos.map(function(b) {
    return '<figure class="grafico-bloco">' +
             "<h3>" + b.titulo + "</h3>" +
             '<figcaption class="grafico-desc">' + b.desc + "</figcaption>" +
             b.svg +
           "</figure>";
  }).join("");
}
