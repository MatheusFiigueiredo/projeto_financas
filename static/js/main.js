// Constantes Base
const SALARIO = 2884.0;

// Gastos Estritamente Fixos - Valores Totais/Cheios
const VALOR_INTERNET = 89.85; // Internet Casa (Digital Net)
const VALOR_CELULAR = 49.99; // Plano de Celular (Claro Flex)
const VALOR_SEGURO = 302.9; // Seguro Carro
const VALOR_TOTAL_AP = 1085.14; // Valor CHEIO do Financiamento/AP (Sua parte será 50%)
const VALOR_TOTAL_CONDOMINIO = 660.0; // Valor CHEIO do Condomínio (Sua parte será 50%)

// Projeções Estimadas de Gastos Variáveis (Início do Mês)
const ESTIMATIVA_AGUA = 115.0;
const ESTIMATIVA_LUZ = 115.0;

let graficoInstancia = null;
let ultimoTotalCartao = -1;
let ultimoMesSelecionado = '';

document.addEventListener('DOMContentLoaded', () => {
  carregarTema();
  const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');
  const select = document.getElementById('seletor-mes');
  if (select) select.value = mesAtual;
  carregarTransacoes();
});

// --- GERENCIAMENTO DE TEMA E INTERFACE ---

function alternarTema() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');

  const btnIcon = document.querySelector('#btn-theme i');
  if (btnIcon) {
    btnIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }

  // Recarrega as transações para redesenhar o gráfico com as cores certas
  carregarTransacoes();
}

function carregarTema() {
  const theme = localStorage.getItem('theme');
  const btnIcon = document.querySelector('#btn-theme i');

  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    if (btnIcon) btnIcon.className = 'fa-solid fa-sun';
  } else {
    document.body.classList.remove('dark-mode');
    if (btnIcon) btnIcon.className = 'fa-solid fa-moon';
  }
}

function alternarAba(nomeAba) {
  document
    .querySelectorAll('.tab-btn')
    .forEach((btn) => btn.classList.remove('active'));
  document
    .querySelectorAll('.tab-content')
    .forEach((content) => content.classList.remove('active'));

  if (nomeAba === 'geral') {
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.getElementById('aba-geral').classList.add('active');
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('aba-detalhes').classList.add('active');
  }
}

function formatarDataMobile(dataStr) {
  if (!dataStr) return '';
  const partes = dataStr.split(' ');
  if (partes.length < 2) return dataStr;

  const [data, hora] = partes;
  const [dia, mes] = data.split('/');
  const [hh, mm] = hora.split(':');

  return `${dia}/${mes} ${hh}:${mm}`;
}

// --- LÓGICA PRINCIPAL E AUTOMAÇÃO ---

async function carregarTransacoes() {
  try {
    const mesSelecionado =
      document.getElementById('seletor-mes')?.value ||
      String(new Date().getMonth() + 1).padStart(2, '0');

    const response = await fetch(`/api/transacoes?mes=${mesSelecionado}`);
    const transacoes = await response.json();

    const tbody = document.getElementById('tabela-transacoes');
    if (tbody) tbody.innerHTML = '';

    let totalCartao = 0;

    // Renderiza a Tabela do Extrato
    if (!transacoes || transacoes.length === 0) {
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="4" style="text-align: center;">Nenhuma compra registrada neste mês.</td></tr>';
      }
    } else {
      transacoes.forEach((t) => {
        totalCartao += parseFloat(t.valor);

        if (tbody) {
          const isC6 = t.banco.toLowerCase().includes('c6');
          const badgeClass = isC6 ? 'c6' : 'picpay';
          const bancoNome = isC6 ? 'C6' : 'PicPay';
          const dataFormatada = formatarDataMobile(t.data_hora);

          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${dataFormatada}</td>
            <td><strong>${t.local}</strong></td>
            <td><span class="badge ${badgeClass}">${bancoNome}</span></td>
            <td class="valor-td">R$ ${parseFloat(t.valor).toFixed(2).replace('.', ',')}</td>
          `;
          tbody.appendChild(row);
        }
      });
    }

    // 1. Identifica se as contas fixas/estimadas foram pagas no extrato deste mês
    const pagoAgua = transacoes.find((t) => {
      const localUpper = (t.local || '').toUpperCase();
      const catUpper = (t.categoria || '').toUpperCase();
      return (
        localUpper.includes('GUARIROBA') ||
        localUpper.includes('AGUAS') ||
        catUpper === 'ÁGUA'
      );
    });

    const pagoLuz = transacoes.find((t) => {
      const localUpper = (t.local || '').toUpperCase();
      const catUpper = (t.categoria || '').toUpperCase();
      return localUpper.includes('ENERGISA') || catUpper === 'LUZ';
    });

    const pagamentosInternet = transacoes.filter((t) => {
      const localUpper = (t.local || '').toUpperCase();
      const catUpper = (t.categoria || '').toUpperCase();
      return (
        localUpper.includes('DIGITAL NET') ||
        localUpper.includes('INTERNET') ||
        localUpper.includes('FIBRA') ||
        catUpper === 'INTERNET'
      );
    });

    const pagoCelular = transacoes.find((t) => {
      const localUpper = (t.local || '').toUpperCase();
      const catUpper = (t.categoria || '').toUpperCase();
      return (
        localUpper.includes('CLARO FLEX') ||
        localUpper.includes('CLARO') ||
        localUpper.includes('CELULAR') ||
        localUpper.includes('TIM') ||
        localUpper.includes('VIVO') ||
        catUpper === 'CELULAR'
      );
    });

    const pagoSeguro = transacoes.find((t) => {
      const localUpper = (t.local || '').toUpperCase();
      const catUpper = (t.categoria || '').toUpperCase();
      return (
        localUpper.includes('COLECIONADORES') ||
        localUpper.includes('ASSOCIACAO') ||
        catUpper === 'SEGURO'
      );
    });

    const pagoAP = transacoes.find((t) => {
      const localUpper = (t.local || '').toUpperCase();
      const catUpper = (t.categoria || '').toUpperCase();
      return (
        localUpper.includes('CAIXA') ||
        localUpper.includes('HABITACAO') ||
        localUpper.includes('FINANCIAMENTO') ||
        catUpper === 'AP' ||
        catUpper === 'FINANCIAMENTO'
      );
    });

    const pagoCondominio = transacoes.find((t) => {
      const localUpper = (t.local || '').toUpperCase();
      const catUpper = (t.categoria || '').toUpperCase();
      return (
        localUpper.includes('AGF') ||
        localUpper.includes('GARANTIDORA') ||
        localUpper.includes('CONDOMINIO') ||
        catUpper === 'CONDOMÍNIO'
      );
    });

    // 2. Define os valores a exibir e desacopla a estimativa/projeção pendente

    // ÁGUA
    let valorAguaExibir = ESTIMATIVA_AGUA;
    let projecaoAguaPendente = ESTIMATIVA_AGUA;
    if (pagoAgua) {
      valorAguaExibir = parseFloat(pagoAgua.valor);
      projecaoAguaPendente = 0;
    }

    // LUZ
    let valorLuzExibir = ESTIMATIVA_LUZ;
    let projecaoLuzPendente = ESTIMATIVA_LUZ;
    if (pagoLuz) {
      valorLuzExibir = parseFloat(pagoLuz.valor);
      projecaoLuzPendente = 0;
    }

    // INTERNET
    let valorInternetExibir = VALOR_INTERNET;
    let projecaoInternetPendente = VALOR_INTERNET;
    if (pagamentosInternet.length > 0) {
      valorInternetExibir = pagamentosInternet.reduce(
        (acc, curr) => acc + parseFloat(curr.valor),
        0
      );
      projecaoInternetPendente = 0;
    }

    // CELULAR
    let valorCelularExibir = VALOR_CELULAR;
    let projecaoCelularPendente = VALOR_CELULAR;
    if (pagoCelular) {
      valorCelularExibir = parseFloat(pagoCelular.valor);
      projecaoCelularPendente = 0;
    }

    // SEGURO
    let valorSeguroExibir = VALOR_SEGURO;
    let projecaoSeguroPendente = VALOR_SEGURO;
    if (pagoSeguro) {
      valorSeguroExibir = parseFloat(pagoSeguro.valor);
      projecaoSeguroPendente = 0;
    }

    // AP (Financiamento - Exibe e calcula apenas a sua METADE / 50%)
    let valorAPExibir = VALOR_TOTAL_AP / 2;
    let projecaoAPPendente = VALOR_TOTAL_AP / 2;
    if (pagoAP) {
      valorAPExibir = parseFloat(pagoAP.valor) / 2;
      projecaoAPPendente = 0;
    }

    // CONDOMÍNIO (Exibe e calcula apenas a sua METADE / 50%)
    let valorCondominioExibir = VALOR_TOTAL_CONDOMINIO / 2;
    let projecaoCondominioPendente = VALOR_TOTAL_CONDOMINIO / 2;
    if (pagoCondominio) {
      valorCondominioExibir = parseFloat(pagoCondominio.valor) / 2;
      projecaoCondominioPendente = 0;
    }

    // 3. Atualiza os textos da Tabela de Resumo com tag de (Pago) ou (Pendente)
    atualizarElementoResumo('resumo-agua', valorAguaExibir, !!pagoAgua);
    atualizarElementoResumo('resumo-luz', valorLuzExibir, !!pagoLuz);
    atualizarElementoResumo(
      'resumo-internet',
      valorInternetExibir,
      pagamentosInternet.length > 0
    );
    atualizarElementoResumo(
      'resumo-celular',
      valorCelularExibir,
      !!pagoCelular
    );
    atualizarElementoResumo('resumo-seguro', valorSeguroExibir, !!pagoSeguro);
    atualizarElementoResumo('resumo-ap', valorAPExibir, !!pagoAP);
    atualizarElementoResumo(
      'resumo-condominio',
      valorCondominioExibir,
      !!pagoCondominio
    );

    // 4. Cálculos Totais Sem Duplicação
    const totalFixosPendentes =
      projecaoAguaPendente +
      projecaoLuzPendente +
      projecaoInternetPendente +
      projecaoCelularPendente +
      projecaoSeguroPendente +
      projecaoAPPendente +
      projecaoCondominioPendente;

    const totalGastosGeral = totalFixosPendentes + totalCartao;
    const saldoRestante = SALARIO - totalGastosGeral;

    // 5. Atualiza os Cards da Tela
    const elCartao = document.getElementById('resumo-cartao');
    const elTotal = document.getElementById('total-gastos');
    const elSaldo = document.getElementById('saldo-restante');

    if (elCartao)
      elCartao.innerText = `R$ ${totalCartao.toFixed(2).replace('.', ',')}`;
    if (elTotal)
      elTotal.innerText = `R$ ${totalGastosGeral.toFixed(2).replace('.', ',')}`;
    if (elSaldo)
      elSaldo.innerText = `R$ ${saldoRestante.toFixed(2).replace('.', ',')}`;

    // 6. Atualiza o Gráfico caso haja mudança de valores ou de mês
    if (
      totalCartao !== ultimoTotalCartao ||
      mesSelecionado !== ultimoMesSelecionado
    ) {
      ultimoTotalCartao = totalCartao;
      ultimoMesSelecionado = mesSelecionado;
      atualizarGrafico(
        totalCartao,
        valorAguaExibir,
        valorLuzExibir,
        valorInternetExibir,
        valorCelularExibir,
        valorSeguroExibir,
        valorAPExibir,
        valorCondominioExibir
      );
    }
  } catch (error) {
    console.error('Erro ao carregar transações:', error);
  }
}

function atualizarElementoResumo(idElemento, valor, isPago) {
  const el = document.getElementById(idElemento);
  if (!el) return;

  const tagStatus = isPago
    ? " <small style='color: #28a745; font-size: 11px;'>(Pago)</small>"
    : " <small style='color: #888; font-size: 11px;'>(Pendente)</small>";

  el.innerHTML = `R$ ${valor.toFixed(2).replace('.', ',')}${tagStatus}`;
}

// --- GRÁFICO DINÂMICO ---

function atualizarGrafico(
  totalCartao,
  valorAgua,
  valorLuz,
  valorInternet,
  valorCelular,
  valorSeguro,
  valorAP,
  valorCondominio
) {
  const ctx = document.getElementById('graficoGastos')?.getContext('2d');
  if (!ctx) return;

  const isDarkMode = document.body.classList.contains('dark-mode');
  const textColor = isDarkMode ? '#e1e1e6' : '#333333';
  const borderColor = isDarkMode ? '#202024' : '#ffffff';

  const valores = [
    totalCartao,
    valorAgua,
    valorLuz,
    valorInternet,
    valorCelular,
    valorSeguro,
    valorAP,
    valorCondominio,
  ];

  const labels = [
    'Cartão + Pix',
    'Água',
    'Luz',
    'Internet',
    'Celular',
    'Seguro',
    'AP (Sua parte)',
    'Condomínio (Sua parte)',
  ];

  const cores = [
    '#0066ff',
    '#00bfff',
    '#ffcc00',
    '#ff6600',
    '#20c997',
    '#28a745',
    '#6f42c1',
    '#e83e8c',
  ];

  if (graficoInstancia) {
    graficoInstancia.destroy();
  }

  graficoInstancia = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [
        {
          data: valores,
          backgroundColor: cores,
          borderWidth: 2,
          borderColor: borderColor,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 400,
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            padding: 10,
            color: textColor,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const val = context.raw;
              const pctDoSalario = ((val / SALARIO) * 100).toFixed(1);
              return ` R$ ${val.toFixed(2).replace('.', ',')} (${pctDoSalario}% do salário)`;
            },
          },
        },
      },
    },
  });
}

// Loop de atualização automática a cada 5 segundos
setInterval(carregarTransacoes, 5000);
