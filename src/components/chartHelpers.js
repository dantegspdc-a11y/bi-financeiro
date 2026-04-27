// ============================================================
// CHART HELPERS — Chart.js configuration presets
// ============================================================

import { Chart, registerables } from 'chart.js';

// Custom inline plugin to draw labels at the end of bars for premium look
const inlineDataLabelsPlugin = {
  id: 'inlineDataLabels',
  afterDatasetsDraw(chart, args, options) {
    const { ctx, data, scales } = chart;
    if (chart.config.type !== 'bar' || chart.config.options.indexAxis !== 'y') return;

    ctx.save();
    ctx.font = "600 11px 'Inter', sans-serif";
    ctx.textBaseline = 'middle';
    
    chart.getDatasetMeta(0).data.forEach((bar, index) => {
      const val = data.datasets[0].data[index];
      if (!val) return;
      const formatted = 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
      ctx.fillStyle = '#cbd5e1'; // text-secondary
      ctx.fillText(formatted, bar.x + 8, bar.y);
    });
    ctx.restore();
  }
};

Chart.register(...registerables, inlineDataLabelsPlugin);

const chartInstances = {};

export function destroyAllCharts() {
  Object.keys(chartInstances).forEach(key => {
    if (chartInstances[key]) { chartInstances[key].destroy(); delete chartInstances[key]; }
  });
}

export function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

const CHART_COLORS = {
  indigo: '#6366f1', purple: '#8b5cf6', blue: '#3b82f6', cyan: '#06b6d4',
  emerald: '#10b981', amber: '#f59e0b', red: '#ef4444', rose: '#f43f5e',
  gray: '#64748b', teal: '#14b8a6', orange: '#f97316', lime: '#84cc16',
};

// Helper to create a premium gradient
function createPremiumGradient(ctx, colorHex) {
  // Extract RGB to make a soft gradient
  const hex = colorHex.replace('#', '');
  const r = parseInt(hex.substring(0,2), 16);
  const g = parseInt(hex.substring(2,4), 16);
  const b = parseInt(hex.substring(4,6), 16);
  
  const gradient = ctx.createLinearGradient(0, 0, 400, 0); // Horizontal gradient
  gradient.addColorStop(0, `rgba(${r},${g},${b},0.6)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},1)`);
  return gradient;
}

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 800, easing: 'easeOutQuart' },
  plugins: {
    legend: {
      labels: {
        color: '#94a3b8',
        font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
        padding: 16, usePointStyle: true, pointStyleWidth: 8,
      },
    },
    tooltip: {
      backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#cbd5e1',
      borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12,
      titleFont: { family: "'Inter', sans-serif", weight: '600', size: 12 },
      bodyFont: { family: "'Inter', sans-serif", size: 11 },
      callbacks: {
        label: function(ctx) {
          let val = ctx.parsed.y ?? ctx.parsed ?? ctx.raw;
          if (typeof val === 'number') return ` ${ctx.dataset.label || ctx.label}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
          return ` ${ctx.dataset.label || ctx.label}: ${val}`;
        }
      }
    },
  },
  scales: {
    x: {
      ticks: { color: '#64748b', font: { family: "'Inter', sans-serif", size: 10 } },
      grid: { color: 'rgba(51,65,85,.4)', drawBorder: false },
    },
    y: {
      ticks: {
        color: '#64748b', font: { family: "'Inter', sans-serif", size: 10 },
        callback: function(v) {
          if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
          if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
          return v;
        }
      },
      grid: { color: 'rgba(51,65,85,.4)', drawBorder: false },
    },
  },
};

export function createBarChart(canvasId, { labels, datasets, stacked = false }) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  
  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map((ds, i) => {
        const baseColor = ds.backgroundColor || ds.color || Object.values(CHART_COLORS)[i];
        return {
          label: ds.label, data: ds.data,
          backgroundColor: Array.isArray(baseColor) ? baseColor.map(c => createPremiumGradient(ctx, c)) : createPremiumGradient(ctx, baseColor),
          borderRadius: 4, borderSkipped: false, barPercentage: 0.6, categoryPercentage: 0.8, ...ds,
        };
      }),
    },
    options: { ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, x: { ...CHART_DEFAULTS.scales.x, stacked }, y: { ...CHART_DEFAULTS.scales.y, stacked, beginAtZero: true } } },
  };
  chartInstances[canvasId] = new Chart(canvas, config);
  return chartInstances[canvasId];
}

export function createLineChart(canvasId, { labels, datasets }) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  const config = {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map((ds, i) => {
        const baseColor = ds.color || Object.values(CHART_COLORS)[i];
        return {
          label: ds.label, data: ds.data,
          borderColor: baseColor,
          backgroundColor: baseColor + '18',
          tension: 0.4, fill: ds.fill !== undefined ? ds.fill : true,
          pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5,
          pointBackgroundColor: baseColor, ...ds,
        };
      }),
    },
    options: { ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, beginAtZero: false } } },
  };
  chartInstances[canvasId] = new Chart(ctx, config);
  return chartInstances[canvasId];
}

export function createDoughnutChart(canvasId, { labels, data, colors }) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  const config = {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors || Object.values(CHART_COLORS).slice(0, data.length), borderColor: '#1e293b', borderWidth: 3, hoverOffset: 6 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { ...CHART_DEFAULTS.plugins.legend, position: 'bottom' },
        tooltip: { ...CHART_DEFAULTS.plugins.tooltip, callbacks: {
          label: function(ctx) {
            const val = ctx.raw;
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = ((val / total) * 100).toFixed(1);
            return ` ${ctx.label}: R$ ${val.toLocaleString('pt-BR')} (${pct}%)`;
          }
        }}
      },
    },
  };
  chartInstances[canvasId] = new Chart(ctx, config);
  return chartInstances[canvasId];
}

export function createHorizontalBarChart(canvasId, { labels, datasets }) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');

  // Truncar nomes longos para alinhamento visual
  const truncatedLabels = labels.map(l => {
    if (l && l.length > 35) return l.slice(0, 33) + '…';
    return l;
  });
  
  const config = {
    type: 'bar',
    data: {
      labels: truncatedLabels,
      datasets: datasets.map((ds, i) => {
        return {
          label: ds.label, data: ds.data,
          backgroundColor: ds.backgroundColor ? ds.backgroundColor.map(c => createPremiumGradient(ctx, c)) : createPremiumGradient(ctx, ds.color || Object.values(CHART_COLORS)[i]),
          borderRadius: 4, borderSkipped: false, barPercentage: 0.6, ...ds,
        };
      }),
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: 'y',
      layout: { padding: { right: 100 } }, // Space for datalabels
      scales: {
        x: { display: false, beginAtZero: true }, // Hide bottom axis for horizontal bars
        y: {
          grid: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { family: "'Inter', sans-serif", size: 10, weight: '500' },
            mirror: false,
            autoSkip: false,
            crossAlign: 'far', // Alinhar da esquerda para direita
          },
          afterFit(scale) {
            scale.width = 260; // Largura fixa para alinhar labels
          },
        },
      },
    },
  };
  chartInstances[canvasId] = new Chart(canvas, config);
  return chartInstances[canvasId];
}

export { CHART_COLORS };
