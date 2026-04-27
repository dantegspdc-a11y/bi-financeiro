// ============================================================
// SIDEBAR COMPONENT — with logo support
// ============================================================

const ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  fileText: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  arrowDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>`,
  arrowUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/></svg>`,
  trending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>`,
  uploadCloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16l-4-4-4 4"/><path d="M12 12v9"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/><path d="M16 16l-4-4-4 4"/></svg>`,
};

const NAV_ITEMS = [
  { id: 'visao-geral', label: 'Visão Geral', icon: 'dashboard' },
  { id: 'a-faturar', label: 'A Faturar', icon: 'fileText' },
  { id: 'contas-receber', label: 'Contas a Receber', icon: 'arrowDown' },
  { id: 'contas-pagar', label: 'Contas a Pagar', icon: 'arrowUp' },
  { id: 'fluxo-caixa', label: 'Fluxo de Caixa', icon: 'trending' },
  { id: 'relatorio', label: 'Relatório Executivo', icon: 'clipboard' },
  { id: 'importar-bases', label: 'Importar Bases', icon: 'uploadCloud' },
];

// Logo is stored in localStorage as base64
function getLogoHtml() {
  const logoData = localStorage.getItem('bi_empresa_logo');
  if (logoData) {
    return `<img src="${logoData}" alt="Logo da empresa" class="sidebar-logo-img" id="sidebar-logo-img" />`;
  }
  return `
    <div class="sidebar-logo-fallback">
      <div class="sidebar-logo-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" stroke-width="2"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6366f1"/><stop offset="100%" style="stop-color:#8b5cf6"/></linearGradient></defs><rect x="2" y="3" width="20" height="18" rx="3"/><path d="M8 7h8M8 11h5M8 15h8"/></svg>
      </div>
    </div>
  `;
}

/** Refresh sidebar logo after upload/remove */
export function refreshSidebarLogo() {
  const container = document.querySelector('.sidebar-brand-logo');
  if (container) {
    container.innerHTML = getLogoHtml();
  }
}

export function renderSidebar(activePage) {
  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand-logo">
          ${getLogoHtml()}
        </div>
        <div class="sidebar-brand-text">
          <h1>BI Financeiro</h1>
          <span>Painel Executivo</span>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="sidebar-nav-label">Navegação</div>
        ${NAV_ITEMS.map(item => `
          <div class="nav-item ${activePage === item.id ? 'active' : ''}" data-page="${item.id}" id="nav-${item.id}">
            ${ICONS[item.icon]}
            <span>${item.label}</span>
          </div>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-footer-version">v2.0 — Executive Edition</div>
        <div class="sidebar-footer-data">Dados Simulados</div>
      </div>
    </aside>
  `;
}

export function getPageTitle(pageId) {
  const item = NAV_ITEMS.find(n => n.id === pageId);
  return item ? item.label : 'BI Financeiro';
}
