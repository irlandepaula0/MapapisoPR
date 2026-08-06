/* ============================================================
   UTIL.JS — Ferramentas Auxiliares (Funções de Apoio)
   ============================================================
   Este arquivo é como uma "caixa de ferramentas".
   Cada função aqui faz uma tarefa específica e é usada
   em vários lugares do projeto.

   PENSE ASSIM: se o projeto fosse uma cozinha, aqui ficariam
   os utensílios: faca, colher, ralador... Cada um tem uma
   função única e é usado em várias receitas.
   ============================================================ */

// ============================================================
// fmt(valor) — Formata número como dinheiro brasileiro
// ============================================================
// O QUE FAZ: Transforma 4580.57 em "R$ 4.580,57"
//
// POR QUE EXISTE: No Brasil usamos vírgula para centavos
// e ponto para milhares. Mas no computador, números usam
// ponto para decimal (sistema americano). Esta função
// "traduz" para o formato que brasileiros entendem.
//
// EXEMPLOS:
//   fmt(3845.63)  → "R$ 3.845,63"
//   fmt(null)     → "—" (traço = sem dado)
//   fmt(0)        → "R$ 0,00"
// ============================================================

function fmt(valor) {
  // Se não tiver valor (null, vazio, undefined), mostra traço
  if (valor === null || valor === undefined || valor === "") {
    return "—";
  }
  // toLocaleString("pt-BR") = "fale comigo em português do Brasil"
  // style: "currency" = formato de dinheiro
  // currency: "BRL" = Real brasileiro
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

// ============================================================
// escHtml(texto) — Escapa caracteres HTML perigosos
// ============================================================
// O QUE FAZ: Transforma <script> em &lt;script&gt;
//
// POR QUE EXISTE: Segurança! Se alguém colocar código
// malicioso na planilha (ex: <script>roubar_dados()</script>),
// esta função transforma em texto comum, não código.
//
// É como colocar um texto perigoso dentro de uma caixa
// de vidro: você vê o texto, mas ele não pode fazer nada.
//
// EXEMPLOS:
//   escHtml("<b>negrito</b>")  → "&lt;b&gt;negrito&lt;/b&gt;"
//   escHtml("João & Maria")   → "João &amp; Maria"
// ============================================================

function escHtml(texto) {
  // Converte para string (se for número, null, etc.)
  const s = String(texto == null ? "" : texto);
  // Substitui cada caractere perigoso pelo código seguro
  return s
    .replace(/&/g, "&amp;")   // & primeiro! (senão bagunça os outros)
    .replace(/</g, "&lt;")    // < vira &lt;
    .replace(/>/g, "&gt;");   // > vira &gt;
}

// ============================================================
// normalizar(texto) — Padroniza nomes para comparar
// ============================================================
// O QUE FAZ: "São João D'Oeste" → "SAOJOAODOESTE"
//
// POR QUE EXISTE: O computador é MUITO literal. "São" e "sao"
// são diferentes para ele. Assim como "João" e "Joao" (com e
// sem acento). Esta função remove tudo que pode causar confusão.
//
// PASSOS:
// 1. normalize("NFD") + replace(/[̀-ͯ]/g, "") 
//    → remove acentos (á→a, ç→c, ã→a)
// 2. toUpperCase() → tudo maiúsculo
// 3. replace(/[^A-Z0-9]/g, "") → remove espaços, traços, apóstrofos
//
// EXEMPLOS:
//   normalizar("Maringá")      → "MARINGA"
//   normalizar("SÃO JOSÉ")     → "SAOJOSE"
//   normalizar("Xambre-Zinho") → "XAMBREZINHO"
// ============================================================

function normalizar(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

// ============================================================
// situacaoAuto(valor, ano) — Descobre se paga acima/abaixo/igual
// ============================================================
// O QUE FAZ: Compara o salário do professor com o piso nacional
//
// POR QUE EXISTE: Às vezes a planilha não diz explicitamente
// se o município paga acima ou abaixo. Esta função calcula
// automaticamente comparando com o piso do ano.
//
// A margem de 0.005 (meio centavo) evita erros de arredondamento
// do computador. Ex: 4580.570000001 é tecnicamente maior que
// 4580.57, mas na prática é igual.
//
// RETORNA: "igual", "acima" ou "abaixo"
// ============================================================

function situacaoAuto(valor, ano) {
  const piso = PISO_NACIONAL[ano];
  // Se o ano não estiver na tabela de pisos, não dá para comparar
  if (piso === undefined || valor === null || valor === undefined) {
    return "sem_dado";
  }
  // Math.abs = valor absoluto (tira o sinal negativo)
  // Se a diferença for menor que meio centavo, considera igual
  if (Math.abs(valor - piso) < 0.005) {
    return "igual";
  }
  // Se não for igual, é maior ou menor
  return valor > piso ? "acima" : "abaixo";
}

// ============================================================
// situacaoNoAnoOuAnterior(municipio, anoReferencia)
// ============================================================
// O QUE FAZ: Procura o dado mais recente disponível até o ano escolhido
//
// POR QUE EXISTE: Imagine que você quer ver dados de 2025, mas
// só tem informação de 2024. Em vez de mostrar "sem dado",
// mostramos o de 2024 com uma notinha "(dado de 2024)".
//
// FUNCIONAMENTO:
// 1. Pega a posição do ano escolhido na lista [2022,2023,2024,2025,2026]
// 2. Começa daquele ano e vai voltando no tempo
// 3. Retorna o PRIMEIRO ano que tiver valor preenchido
//
// EXEMPLO: anoReferencia = 2025
//   - 2025: sem dado → continua
//   - 2024: tem dado! → retorna 2024
// ============================================================

function situacaoNoAnoOuAnterior(municipio, anoReferencia) {
  const idx = ANOS.indexOf(anoReferencia);
  // Vai do ano escolhido até o mais antigo (índice 0)
  for (let i = idx; i >= 0; i--) {
    const ano = ANOS[i];
    const dado = municipio.anos && municipio.anos[ano];
    // Se tiver valor preenchido, retorna ele
    if (dado && dado.valor) {
      return {
        ano: ano,
        situacao: dado.situacao || situacaoAuto(dado.valor, ano),
        valor: dado.valor
      };
    }
  }
  // Não achou nada em nenhum ano
  return null;
}

// ============================================================
// folhaNoAnoOuAnterior(municipio, anoReferencia)
// ============================================================
// O QUE FAZ: Procura a auditoria de folha mais recente disponível
// até o ano escolhido — mesma ideia de situacaoNoAnoOuAnterior,
// mas para os campos municipio.folha_AAAA em vez de municipio.anos.
//
// EXEMPLO: anoReferencia = 2025, só existe folha de 2023
//   - 2025: sem folha → continua
//   - 2024: sem folha → continua
//   - 2023: tem folha! → retorna { ano: 2023, folha: {...} }
//
// Anos de folha POSTERIORES ao ano em tela nunca entram — não faz
// sentido usar uma auditoria de 2025 pra classificar uma consulta
// de 2022.
// ============================================================

function folhaNoAnoOuAnterior(municipio, anoReferencia) {
  for (let i = 0; i < ANOS_FOLHA.length; i++) {
    const ano = ANOS_FOLHA[i];
    if (ano > anoReferencia) continue;
    const folha = municipio["folha_" + ano];
    if (folha) {
      return { ano: ano, folha: folha };
    }
  }
  return null;
}

// ============================================================
// classificarMunicipio(municipio) — Decide a cor do município
// ============================================================
// O QUE FAZ: Determina se o município "paga", "nao_paga" ou
// está "sem_dado"
//
// POR QUE EXISTE: É o "cérebro" da classificação visual.
// Prioriza a folha de pagamento (dado mais confiável) e
// usa os dados legislativos como alternativa.
//
// REGRAS:
// 1. Se tem folha de pagamento no ano selecionado (ou no ano com
//    auditoria mais recente até ele) → usa ela (prioridade máxima)
// 2. Se não tem folha → procura dados legislativos do ano selecionado
// 3. Se não acha nada → "sem_dado"
// ============================================================

function classificarMunicipio(municipio) {
  // Prioridade 1: auditoria de folha de pagamento (dado mais confiável)
  const folhaInfo = folhaNoAnoOuAnterior(municipio, anoSelecionado);
  if (folhaInfo) {
    return folhaCumpre(folhaInfo.folha) ? "paga" : "nao_paga";
  }
  // Prioridade 2: dados legislativos do ano selecionado (ou anterior)
  const info = situacaoNoAnoOuAnterior(municipio, anoSelecionado);
  if (!info) {
    return "sem_dado";
  }
  return info.situacao === "abaixo" ? "nao_paga" : "paga";
}

// ============================================================
// folhaCumpre(folha) — Lê o veredito da auditoria de folha
// ============================================================
// O QUE FAZ: Diz se o texto de situação da folha significa
// "cumpre o piso" ou não.
//
// POR QUE NÃO BASTA PROCURAR "CUMPRE":
// A palavra "CUMPRE" está dentro de "DESCUMPRE". Procurar a
// palavra solta classificaria errado. Aqui exigimos que o texto
// COMECE com "CUMPRE" — "DESCUMPRE" e "DESCUMPRIU" começam com
// "DESC" e portanto caem no lado do descumprimento.
// ============================================================

function folhaCumpre(folha) {
  const texto = String((folha && folha.situacao) || "").trim().toUpperCase();
  return texto.indexOf("CUMPRE") === 0;
}

// ============================================================
// pisoDoAno(ano) / diferencaParaPiso(valor, ano)
// ============================================================
// O QUE FAZEM: Devolvem o piso nacional do ano e a diferença
// entre o que o município paga e esse piso.
//
// SINAL DA DIFERENÇA:
//   positivo → paga acima do piso
//   negativo → paga abaixo (é o que interessa para a ação sindical)
// ============================================================

function pisoDoAno(ano) {
  const piso = PISO_NACIONAL[ano];
  return piso === undefined ? null : piso;
}

function diferencaParaPiso(valor, ano) {
  const piso = pisoDoAno(ano);
  if (piso === null || valor === null || valor === undefined || valor === "") {
    return null;
  }
  return Number(valor) - piso;
}

// ============================================================
// fmtDif(diferenca) — Formata a diferença com sinal e cor
// ============================================================
// Devolve HTML já pronto: verde para acima, vermelho para abaixo,
// cinza para "igual" (diferença menor que meio centavo).
// ============================================================

function fmtDif(diferenca) {
  if (diferenca === null) {
    return '<span style="color:var(--ink-dim)">—</span>';
  }
  if (Math.abs(diferenca) < 0.005) {
    return '<span style="color:var(--igual)">no piso</span>';
  }
  const cor = diferenca > 0 ? "var(--ok)" : "var(--err)";
  const sinal = diferenca > 0 ? "+" : "−";
  return '<span style="color:' + cor + '">' + sinal + " " + fmt(Math.abs(diferenca)) + "</span>";
}

// ============================================================
// debounce(funcao, tempo) — Evita execuções repetidas rápidas
// ============================================================
// O QUE FAZ: "Segura" a função por um tempo antes de executar
//
// POR QUE EXISTE: Quando você digita na busca, cada letra
// dispara uma nova busca. Com 400 municípios, isso TRAVA
// o navegador. O debounce espera você PARAR de digitar
// por 300ms antes de buscar.
//
// ANALOGIA: É como um interruptor de luz com sensor de
// movimento. A luz só apaga depois que você para de se
// mexer por alguns segundos.
//
// EXEMPLO: debounce(renderResumo, 300)
//   - Você digita "Mar" → espera 300ms → busca
//   - Você digita "Mari" antes dos 300ms → reinicia contagem
//   - Você para de digitar → depois de 300ms → busca "Maringá"
// ============================================================

function debounce(funcao, tempo) {
  let timer; // guarda o "alarme" temporário
  return function(...argumentos) {
    // Cancela o alarme anterior (se existir)
    clearTimeout(timer);
    // Cria novo alarme: daqui a X milissegundos, executa a função
    timer = setTimeout(() => {
      funcao.apply(this, argumentos);
    }, tempo);
  };
}