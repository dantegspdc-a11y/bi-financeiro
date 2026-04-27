// ============================================================
// DATA TABLE COMPONENT — with search, sort, pagination
// ============================================================

const PAGE_SIZE = 15;

/**
 * Renders the table skeleton.
 * Rows are now rendered dynamically by initTableInteractions to ensure performance.
 */
export function renderDataTable({ id, title, columns, rows, searchable = true, paginated = true }) {
  const searchHtml = searchable
    ? `<input type="text" class="table-search" id="${id}-search" placeholder="Buscar..." />`
    : '';

  const countHtml = `<span class="table-count" id="${id}-count">${rows.length} registros</span>`;

  const thHtml = columns.map((col, i) =>
    `<th data-col="${i}" data-sort="none" class="sortable">${col.label} <span class="sort-icon">↕</span></th>`
  ).join('');

  const paginationHtml = paginated ? `
    <div class="table-pagination" id="${id}-pagination">
      <button class="btn btn-outline btn-sm" id="${id}-prev" disabled>← Anterior</button>
      <span class="pagination-info" id="${id}-page-info">Página 1 de ...</span>
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
          <tbody id="${id}-tbody">
            <!-- Rows rendered dynamically -->
          </tbody>
        </table>
      </div>
      ${paginationHtml}
    </div>
  `;
}

function generateRowHtml(row, columns) {
  const cells = columns.map(col => {
    const val = col.render ? col.render(row) : (row[col.key] ?? '—');
    const cls = col.className || '';
    return `<td class="${cls}">${val}</td>`;
  }).join('');
  return `<tr>${cells}</tr>`;
}

export function initTableInteractions(tableId, columns, initialRows) {
  const table = document.getElementById(tableId);
  if (!table) return;

  let currentRows = [...initialRows];
  let currentPage = 1;
  let searchTerm = '';

  const tbody = document.getElementById(`${tableId}-tbody`);
  const countSpan = document.getElementById(`${tableId}-count`);
  const pageInfo = document.getElementById(`${tableId}-page-info`);
  const prevBtn = document.getElementById(`${tableId}-prev`);
  const nextBtn = document.getElementById(`${tableId}-next`);

  function updateTable() {
    const filteredRows = searchTerm 
      ? currentRows.filter(r => JSON.stringify(Object.values(r)).toLowerCase().includes(searchTerm))
      : currentRows;

    const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredRows.slice(start, start + PAGE_SIZE);

    if (tbody) {
      tbody.innerHTML = pageRows.map(r => generateRowHtml(r, columns)).join('');
    }

    if (countSpan) countSpan.textContent = `${filteredRows.length} registros`;
    if (pageInfo) pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  }

  // Search
  const searchInput = document.getElementById(`${tableId}-search`);
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchTerm = searchInput.value.toLowerCase();
      currentPage = 1;
      updateTable();
    });
  }

  // Sort
  const ths = table.querySelectorAll('th.sortable');
  ths.forEach(th => {
    th.addEventListener('click', () => {
      const colIdx = parseInt(th.dataset.col);
      const col = columns[colIdx];
      const currentSort = th.dataset.sort;
      const newSort = currentSort === 'asc' ? 'desc' : 'asc';

      ths.forEach(h => {
        h.dataset.sort = 'none';
        h.classList.remove('sorted');
      });
      th.dataset.sort = newSort;
      th.classList.add('sorted');

      currentRows.sort((a, b) => {
        let aVal = a[col.key];
        let bVal = b[col.key];
        
        // Handle numeric values
        if (typeof aVal === 'string' && aVal.includes('R$')) {
          aVal = parseFloat(aVal.replace(/[R$\s.%]/g, '').replace(',', '.'));
          bVal = parseFloat(String(bVal).replace(/[R$\s.%]/g, '').replace(',', '.'));
        }

        if (aVal < bVal) return newSort === 'asc' ? -1 : 1;
        if (aVal > bVal) return newSort === 'asc' ? 1 : -1;
        return 0;
      });

      currentPage = 1;
      updateTable();
    });
  });

  // Pagination
  if (prevBtn) prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; updateTable(); } };
  if (nextBtn) nextBtn.onclick = () => { const totalPages = Math.ceil((searchTerm ? currentRows.filter(r => JSON.stringify(Object.values(r)).toLowerCase().includes(searchTerm)) : currentRows).length / PAGE_SIZE); if (currentPage < totalPages) { currentPage++; updateTable(); } };

  // Initial render
  updateTable();
}

/** Legacy support for smaller tables where ranking is needed */
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
