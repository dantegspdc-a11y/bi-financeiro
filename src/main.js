// ============================================================
// MAIN — Router, Layout, Initialization
// BI Financeiro Executivo v2.0
// ============================================================

import './style.css';
import { renderSidebar, getPageTitle } from './components/sidebar.js';
import { destroyAllCharts } from './components/chartHelpers.js';
import { carregarDados } from './data/businessLogic.js';

import * as visaoGeral from './pages/visaoGeral.js';
import * as aFaturar from './pages/aFaturar.js';
import * as contasReceber from './pages/contasReceber.js';
import * as contasPagar from './pages/contasPagar.js';
import * as fluxoCaixa from './pages/fluxoCaixa.js';
import * as relatorioExecutivo from './pages/relatorioExecutivo.js';
import * as importarBases from './pages/importarBases.js';

const PAGES = {
  'visao-geral': visaoGeral,
  'a-faturar': aFaturar,
  'contas-receber': contasReceber,
  'contas-pagar': contasPagar,
  'fluxo-caixa': fluxoCaixa,
  'relatorio': relatorioExecutivo,
  'importar-bases': importarBases,
};

let currentPage = 'visao-geral';


function getPageFromHash() {
  const hash = window.location.hash.replace('#', '');
  return PAGES[hash] ? hash : 'visao-geral';
}

function renderLayout() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(currentPage)}
      <div class="main-area">
        <header class="header" id="header">
          <div class="header-left">
            <h2 class="header-title" id="header-title">${getPageTitle(currentPage)}</h2>
          </div>
          <div class="header-filters" id="header-filters">
            <span class="header-timestamp">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </header>
        <main class="content" id="content"></main>
      </div>
    </div>
  `;
}

function renderPage(pageId) {
  destroyAllCharts();
  document.body.classList.remove('report-mode');
  currentPage = pageId;
  const pageModule = PAGES[pageId];

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageId);
  });

  const headerTitle = document.getElementById('header-title');
  if (headerTitle) headerTitle.textContent = getPageTitle(pageId);

  // Restore sidebar/header if hidden by report mode
  const sidebar = document.getElementById('sidebar');
  const header = document.getElementById('header');
  if (sidebar) sidebar.style.display = '';
  if (header) header.style.display = '';

  const content = document.getElementById('content');
  if (content && pageModule) {
    content.innerHTML = pageModule.render();
    requestAnimationFrame(() => { pageModule.init(); });
  }

  if (window.location.hash !== `#${pageId}`) {
    history.replaceState(null, '', `#${pageId}`);
  }
}

function attachNavListeners() {
  document.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (navItem && navItem.dataset.page) {
      e.preventDefault();
      renderPage(navItem.dataset.page);
    }
  });
}

async function init() {
  currentPage = getPageFromHash();
  renderLayout();
  attachNavListeners();

  const content = document.getElementById('content');
  if (content) {
    content.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50vh; color: #94a3b8; font-family: Inter, sans-serif;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; margin-bottom: 1rem;"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        <div style="font-size: 1.1rem; font-weight: 500; color: #e2e8f0;">Sincronizando banco de dados...</div>
        <div style="font-size: 0.9rem; margin-top: 8px;">Baixando registros (pode levar alguns segundos na primeira vez)</div>
        <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
      </div>
    `;
  }

  await carregarDados();
  
  renderPage(currentPage);

  window.addEventListener('hashchange', () => {
    const pageId = getPageFromHash();
    if (pageId !== currentPage) renderPage(pageId);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
