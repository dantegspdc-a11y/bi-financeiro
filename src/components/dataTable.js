// ============================================================
// DATA TABLE COMPONENT — with search, sort, pagination
// ============================================================

const PAGE_SIZE = 15;

export function renderDataTable({ id, title, columns, rows, searchable = true, paginated = true }) {
  const searchHtml = searchable
    ? `<input type="text" class="table-search" id="${id}-search" placeholder="Buscar..." />`
    : '';

  const countHtml = `<span class="table-count" id="${id}-count">${rows.length} registros</span>`;

  const thHtml = columns.map((col, i) =>
    `<th data-col="${i}" data-sort="asc" class="sortable">${col.label} <span class="sort-icon">↕</span></th>`
  ).join('');

  const trHtml = rows.map((row, idx) => {
    const cells = columns.map(col => {
      const val = col.render ? col.render(row) : (row[col.key] ?? '—');
      const cls = col.className || '';
      return `<td class="${cls}">${val}</td>`;
    }).join('');
    return `<tr data-row-idx="${idx}">${cells}</tr>`;
  }).join('');

  const paginationHtml = paginated && rows.length > PAGE_SIZE ? `
    <div class="table-pagination" id="${id}-pagination">
      <button class="btn btn-outline btn-sm" id="${id}-prev" disabled>← Anterior</button>
      <span class="pagination-info" id="${id}-page-info">Página 1 de ${Math.ceil(rows.length / PAGE_SIZE)}</span>
      <button class="btn btn-outline btn-sm" id="${id}-next">Próxima →</button>
    </div>
  ` : '';

  return `
    <div class="table-card" id="${id}">
      <div class="table-header">
        <div class="table-header-left">
          <span class="table-header-title">${title}</span>
          ${countHtml}
        </div>
        <div class="table-header-actions">
          ${searchHtml}
        </div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>${thHtml}</tr></thead>
          <tbody id="${id}-tbody">${trHtml}</tbody>
        </table>
      </div>
      ${paginationHtml}
    </div>
  `;
}

export function renderRankingTable({ id, title, columns, rows, rankColumn = true }) {
  const thHtml = (rankColumn ? '<th class="rank-col">#</th>' : '') +
    columns.map((col, i) =>
      `<th data-col="${i}" class="${col.className || ''}">${col.label}</th>`
    ).join('');

  const trHtml = rows.map((row, idx) => {
    const rankCell = rankColumn ? `<td class="rank-col"><span class="rank-badge ${idx < 3 ? 'rank-top' : ''}">${idx + 1}</span></td>` : '';
    const cells = columns.map(col => {
      const val = col.render ? col.render(row) : (row[col.key] ?? '—');
      const cls = col.className || '';
      return `<td class="${cls}">${val}</td>`;
    }).join('');
    return `<tr>${rankCell}${cells}</tr>`;
  }).join('');

  return `
    <div class="table-card ranking-table" id="${id}">
      <div class="table-header">
        <div class="table-header-left">
          <span class="table-header-title">${title}</span>
          <span class="table-count">${rows.length} itens</span>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>${thHtml}</tr></thead>
          <tbody>${trHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderProgressBar(pct, color = 'indigo') {
  const clamped = Math.min(100, Math.max(0, pct));
  return `<div class="progress-bar-wrapper"><div class="progress-bar ${color}" style="width:${clamped}%"></div><span class="progress-label">${clamped.toFixed(1)}%</span></div>`;
}

export function initTableInteractions(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  // Search
  const searchInput = document.getElementById(`${tableId}-search`);
  const countSpan = document.getElementById(`${tableId}-count`);
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      const rows = table.querySelectorAll('tbody tr');
      let visible = 0;
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const show = text.includes(q);
        row.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      if (countSpan) countSpan.textContent = `${visible} registros`;
      // Reset pagination
      if (table.querySelector('.table-pagination')) applyPagination(tableId);
    });
  }

  // Sort
  const ths = table.querySelectorAll('th.sortable');
  ths.forEach(th => {
    th.addEventListener('click', () => {
      const colIdx = parseInt(th.dataset.col);
      const asc = th.dataset.sort === 'asc';
      th.dataset.sort = asc ? 'desc' : 'asc';
      ths.forEach(h => h.classList.remove('sorted'));
      th.classList.add('sorted');

      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      rows.sort((a, b) => {
        const aVal = a.children[colIdx]?.textContent?.trim() || '';
        const bVal = b.children[colIdx]?.textContent?.trim() || '';
        const aNum = parseFloat(aVal.replace(/[R$\s.%]/g, '').replace(',', '.'));
        const bNum = parseFloat(bVal.replace(/[R$\s.%]/g, '').replace(',', '.'));
        if (!isNaN(aNum) && !isNaN(bNum)) return asc ? aNum - bNum : bNum - aNum;
        return asc ? aVal.localeCompare(bVal, 'pt-BR') : bVal.localeCompare(aVal, 'pt-BR');
      });
      rows.forEach(r => tbody.appendChild(r));
      if (table.querySelector('.table-pagination')) applyPagination(tableId);
    });
  });

  // Pagination
  if (table.querySelector('.table-pagination')) applyPagination(tableId);
}

function applyPagination(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const rows = Array.from(table.querySelectorAll('tbody tr')).filter(r => r.style.display !== 'none');
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  let currentPage = 1;

  function showPage(page) {
    currentPage = page;
    rows.forEach((r, i) => {
      r.style.display = (i >= (page - 1) * PAGE_SIZE && i < page * PAGE_SIZE) ? '' : 'none';
    });
    const info = document.getElementById(`${tableId}-page-info`);
    if (info) info.textContent = `Página ${page} de ${totalPages}`;
    const prev = document.getElementById(`${tableId}-prev`);
    const next = document.getElementById(`${tableId}-next`);
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= totalPages;
  }

  const prev = document.getElementById(`${tableId}-prev`);
  const next = document.getElementById(`${tableId}-next`);
  if (prev) prev.onclick = () => { if (currentPage > 1) showPage(currentPage - 1); };
  if (next) next.onclick = () => { if (currentPage < totalPages) showPage(currentPage + 1); };

  showPage(1);
}
