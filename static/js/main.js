// Constantes Base
const SALARIO = 2884.0;

// Gastos Estritamente Fixos (Não mudam de valor)
const VALOR_INTERNET = 139.51; // Casa + Celular
const VALOR_SEGURO = 302.9; // Seguro Carro
const VALOR_AP = 542.57; // Financiamento / AP (Sua parte)

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

    // 1. Identifica se a Água ou a Luz foram pagas no extrato deste mês
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

    // 2. Define o valor a exibir na Projeção/Tabela
    // Se a conta já foi paga, zeramos a projeção para não duplicar no cálculo total!
    let valorAguaExibir = ESTIMATIVA_AGUA;
    let projecaoAguaPendente = ESTIMATIVA_AGUA;
    if (pagoAgua) {
      valorAguaExibir = parseFloat(pagoAgua.valor);
      projecaoAguaPendente = 0; // Desliga a estimativa do total pendente
    }

    let valorLuzExibir = ESTIMATIVA_LUZ;
    let projecaoLuzPendente = ESTIMATIVA_LUZ;
    if (pagoLuz) {
      valorLuzExibir = parseFloat(pagoLuz.valor);
      projecaoLuzPendente = 0; // Desliga a estimativa do total pendente
    }

    // 3. Atualiza os textos da Tabela de Resumo com tag de (Pago) ou (Estimado)
    atualizarElementoResumo('resumo-agua', valorAguaExibir, !!pagoAgua);
    atualizarElementoResumo('resumo-luz', valorLuzExibir, !!pagoLuz);

    // 4. Cálculos Totais Sem Duplicação
    const totalFixosPendentes =
      projecaoAguaPendente +
      projecaoLuzPendente +
      VALOR_INTERNET +
      VALOR_SEGURO +
      VALOR_AP;
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

    // 6. Atualiza o Gráfico caso haja mudança
    if (
      totalCartao !== ultimoTotalCartao ||
      mesSelecionado !== ultimoMesSelecionado
    ) {
      ultimoTotalCartao = totalCartao;
      ultimoMesSelecionado = mesSelecionado;
      atualizarGrafico(totalCartao, valorAguaExibir, valorLuzExibir);
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
    : " <small style='color: #888; font-size: 11px;'>(Estimado)</small>";

  el.innerHTML = `R$ ${valor.toFixed(2).replace('.', ',')}${tagStatus}`;
}

// --- GRÁFICO DINÂMICO ---

function atualizarGrafico(totalCartao, valorAgua, valorLuz) {
  const ctx = document.getElementById('graficoGastos')?.getContext('2d');
  if (!ctx) return;

  const isDarkMode = document.body.classList.contains('dark-mode');
  const textColor = isDarkMode ? '#e1e1e6' : '#333333';
  const borderColor = isDarkMode ? '#202024' : '#ffffff';

  const valores = [
    totalCartao, // Cartão + Pix
    valorAgua, // Água (Estimada ou Paga)
    valorLuz, // Luz (Estimada ou Paga)
    VALOR_INTERNET, // Internet
    VALOR_SEGURO, // Seguro
    VALOR_AP, // AP + Condomínio
  ];

  const labels = [
    'Cartão + Pix',
    'Água',
    'Luz',
    'Internet',
    'Seguro',
    'AP + Condomínio',
  ];

  const cores = [
    '#0066ff',
    '#00bfff',
    '#ffcc00',
    '#ff6600',
    '#28a745',
    '#6f42c1',
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
