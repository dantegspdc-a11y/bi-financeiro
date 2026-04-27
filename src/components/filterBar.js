// ============================================================
// FILTER BAR COMPONENT — Barra de filtros reutilizável
// ============================================================

export function renderFilterBar({ id, filters = [], onApplyId }) {
  const filtersHtml = filters.map(f => {
    if (f.type === 'select') {
      const opts = f.options.map(o =>
        `<option value="${o.value}" ${o.value === (f.selected || '') ? 'selected' : ''}>${o.label}</option>`
      ).join('');
      return `
        <div class="filter-group">
          <label class="filter-label" for="${f.id}">${f.label}</label>
          <select class="filter-select" id="${f.id}" data-filter-key="${f.key}">
            <option value="">Todos</option>
            ${opts}
          </select>
        </div>
      `;
    }
    if (f.type === 'search') {
      return `
        <div class="filter-group">
          <label class="filter-label" for="${f.id}">${f.label}</label>
          <input type="text" class="filter-input" id="${f.id}" data-filter-key="${f.key}" placeholder="${f.placeholder || 'Buscar...'}" />
        </div>
      `;
    }
    return '';
  }).join('');

  return `
    <div class="filter-bar" id="${id}">
      <div class="filter-bar-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
      </div>
      <div class="filter-bar-fields">
        ${filtersHtml}
      </div>
      <button class="btn btn-outline filter-btn-clear" id="${id}-clear" title="Limpar filtros">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Limpar
      </button>
    </div>
  `;
}

export function initFilterBar(barId, onFilterChange) {
  const bar = document.getElementById(barId);
  if (!bar) return;

  const getFilters = () => {
    const filters = {};
    bar.querySelectorAll('[data-filter-key]').forEach(el => {
      const key = el.dataset.filterKey;
      const val = el.value.trim();
      if (val) filters[key] = val;
    });
    return filters;
  };

  bar.querySelectorAll('select[data-filter-key]').forEach(sel => {
    sel.addEventListener('change', () => onFilterChange(getFilters()));
  });

  bar.querySelectorAll('input[data-filter-key]').forEach(inp => {
    let timeout;
    inp.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => onFilterChange(getFilters()), 300);
    });
  });

  const clearBtn = document.getElementById(`${barId}-clear`);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      bar.querySelectorAll('select[data-filter-key]').forEach(s => s.value = '');
      bar.querySelectorAll('input[data-filter-key]').forEach(i => i.value = '');
      onFilterChange({});
    });
  }
}

export function buildSelectOptions(values) {
  return values.map(v => ({ value: v, label: v }));
}
