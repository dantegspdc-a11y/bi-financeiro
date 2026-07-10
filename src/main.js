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

const KIOSK_PAGES = ['visao-geral', 'a-faturar', 'contas-receber', 'contas-pagar', 'fluxo-caixa'];
const KIOSK_INTERVAL_MS = 8000; // 8 segundos por página

let currentPage = 'visao-geral';
let kioskTimer = null;
let kioskIndex = 0;
let kioskProgressTimer = null;


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
            <button class="btn btn-outline btn-sm" id="btn-kiosk" title="Modo Quiosque — rotação automática de páginas">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Quiosque
            </button>
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

// ============================================================
// MODO QUIOSQUE
// ============================================================

function startKiosk() {
  kioskIndex = KIOSK_PAGES.indexOf(currentPage);
  if (kioskIndex < 0) kioskIndex = 0;

  document.body.classList.add('kiosk-mode');

  // Inject overlay bar
  let bar = document.getElementById('kiosk-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'kiosk-bar';
    bar.innerHTML = `
      <div class="kiosk-bar-inner">
        <div class="kiosk-bar-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <span>Modo Quiosque</span>
          <span class="kiosk-page-label" id="kiosk-page-label"></span>
        </div>
        <div class="kiosk-bar-right">
          <button id="btn-kiosk-stop" class="btn btn-sm" style="background:var(--accent-red);color:#fff;border:none;">✕ Sair</button>
        </div>
      </div>
      <div class="kiosk-progress"><div class="kiosk-progress-fill" id="kiosk-progress-fill"></div></div>
    `;
    document.body.appendChild(bar);
    document.getElementById('btn-kiosk-stop').addEventListener('click', stopKiosk);
  }
  bar.style.display = 'block';

  kioskShowPage();

  kioskTimer = setInterval(() => {
    kioskIndex = (kioskIndex + 1) % KIOSK_PAGES.length;
    kioskShowPage();
  }, KIOSK_INTERVAL_MS);

  // ESC to exit
  document.addEventListener('keydown', kioskEscHandler);
}

function kioskShowPage() {
  renderPage(KIOSK_PAGES[kioskIndex]);
  updateKioskLabel();
  startKioskProgress();
  kioskAutoScroll();
}

let kioskScrollTimer = null;

function kioskAutoScroll() {
  // Clear any pending scroll timer
  if (kioskScrollTimer) { clearTimeout(kioskScrollTimer); kioskScrollTimer = null; }

  const content = document.getElementById('content');
  if (!content) return;

  // Start at top
  content.scrollTo({ top: 0, behavior: 'instant' });

  // After half the time, scroll smoothly to the bottom
  kioskScrollTimer = setTimeout(() => {
    const scrollTarget = content.scrollHeight - content.clientHeight;
    if (scrollTarget > 0) {
      content.scrollTo({ top: scrollTarget, behavior: 'smooth' });
    }
  }, KIOSK_INTERVAL_MS / 2);
}

function updateKioskLabel() {
  const label = document.getElementById('kiosk-page-label');
  if (label) label.textContent = `— ${getPageTitle(KIOSK_PAGES[kioskIndex])} (${kioskIndex + 1}/${KIOSK_PAGES.length})`;
}

function startKioskProgress() {
  const fill = document.getElementById('kiosk-progress-fill');
  if (!fill) return;
  // Reset animation
  fill.style.transition = 'none';
  fill.style.width = '0%';
  // Force reflow
  fill.offsetWidth;
  fill.style.transition = `width ${KIOSK_INTERVAL_MS}ms linear`;
  fill.style.width = '100%';
}

function stopKiosk() {
  document.body.classList.remove('kiosk-mode');
  if (kioskTimer) { clearInterval(kioskTimer); kioskTimer = null; }
  if (kioskScrollTimer) { clearTimeout(kioskScrollTimer); kioskScrollTimer = null; }
  const bar = document.getElementById('kiosk-bar');
  if (bar) bar.style.display = 'none';
  document.removeEventListener('keydown', kioskEscHandler);
}

function kioskEscHandler(e) {
  if (e.key === 'Escape') stopKiosk();
}

async function init() {
  currentPage = getPageFromHash();
  renderLayout();
  attachNavListeners();

  // Kiosk button
  document.getElementById('btn-kiosk')?.addEventListener('click', () => {
    if (kioskTimer) { stopKiosk(); } else { startKiosk(); }
  });

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
