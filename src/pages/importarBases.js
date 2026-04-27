import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase.js';
import { carregarDados } from '../data/businessLogic.js';
import { refreshSidebarLogo } from '../components/sidebar.js';

export function render() {
  const currentLogo = localStorage.getItem('bi_empresa_logo');
  const hasLogo = !!currentLogo;

  return `
    <div class="page-enter" style="max-width: 800px; margin: 0 auto; padding: 24px;">

      <!-- SEÇÃO: Logo da Empresa -->
      <div class="import-block" style="background: var(--bg-card); padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid var(--border-color);">
        <h3 style="margin-bottom: 16px; color: var(--text-color); font-weight: 500; font-size: 1.1rem;"><span class="dot indigo"></span>Logo da Empresa</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">Anexe o logo da sua empresa (PNG ou JPG). Será exibido na sidebar do BI.</p>
        
        <div id="logo-preview-container" style="margin-bottom: 16px; display: ${hasLogo ? 'flex' : 'none'}; align-items: center; gap: 16px;">
          <div style="background: var(--bg-sidebar); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 16px; display: inline-flex; align-items: center;">
            <img id="logo-preview-img" src="${hasLogo ? currentLogo : ''}" alt="Preview" style="height: 42px; width: auto; object-fit: contain; max-width: 200px;" />
          </div>
          <button id="btn-remover-logo" class="btn" style="background: var(--accent-red); color: white; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; font-weight: 500; font-size: 0.85rem;">Remover Logo</button>
        </div>

        <div id="logo-upload-area" style="display: ${hasLogo ? 'none' : 'block'};">
          <input type="file" id="file-logo" accept=".png,.jpg,.jpeg" style="margin-bottom: 16px; display: block; color: var(--text-color);" />
          <button id="btn-salvar-logo" class="btn" style="background: var(--accent-indigo); color: white; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; font-weight: 500;">Salvar Logo</button>
        </div>
      </div>

      <div class="import-block" style="background: var(--bg-card); padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid var(--border-color);">
        <h3 style="margin-bottom: 16px; color: var(--text-color); font-weight: 500; font-size: 1.1rem;"><span class="dot emerald"></span>1. Importar Base A Pagar</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">Limpa os dados atuais de 'contas_pagar' e importa os novos.</p>
        <input type="file" id="file-pagar" accept=".xlsx" style="margin-bottom: 16px; display: block; color: var(--text-color);" />
        <button id="btn-importar-pagar" class="btn" style="background: var(--emerald-500); color: white; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; font-weight: 500;">Importar para Supabase</button>
      </div>

      <div class="import-block" style="background: var(--bg-card); padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid var(--border-color);">
        <h3 style="margin-bottom: 16px; color: var(--text-color); font-weight: 500; font-size: 1.1rem;"><span class="dot blue"></span>2. Importar Base A Receber</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">Limpa os dados atuais de 'contas_receber' e importa os novos.</p>
        <input type="file" id="file-receber" accept=".xlsx" style="margin-bottom: 16px; display: block; color: var(--text-color);" />
        <button id="btn-importar-receber" class="btn" style="background: var(--blue-500); color: white; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; font-weight: 500;">Importar para Supabase</button>
      </div>

      <div class="import-block" style="background: var(--bg-card); padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid var(--border-color);">
        <h3 style="margin-bottom: 16px; color: var(--text-color); font-weight: 500; font-size: 1.1rem;"><span class="dot indigo"></span>3. Importar Base A Fatura</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">Limpa os dados atuais de 'faturamento' e importa os novos.</p>
        <input type="file" id="file-fatura" accept=".xlsx" style="margin-bottom: 16px; display: block; color: var(--text-color);" />
        <button id="btn-importar-fatura" class="btn" style="background: var(--indigo-500); color: white; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; font-weight: 500;">Importar para Supabase</button>
      </div>
    </div>
  `;
}

// Mapas de cabeçalhos
const mapPagar = {
  "Documento": "documento",
  "Dt.Emissão": "dt_emissao",
  "Dt.Vencimento": "dt_vencimento",
  "Parcelas - Valor Parcela": "valor_parcela",
  "Situação": "situacao",
  "Tipo de Conta": "tipo_conta",
  "Parcelas - Conferência": "conferencia",
  "Observação": "observacao",
  "Beneficiário": "beneficiario",
  "Parcelas - Dt.Baixa": "dt_baixa",
  "Parcelas - Movimento no caixa/bancos (Data)": "movimento_data",
  "Parcelas - Movimento no caixa/bancos (Conta)": "movimento_conta"
};

const mapReceber = {
  "Vendas (Dt.Emissão)": "vendas_dt_emissao",
  "Dt.Vencimento": "dt_vencimento",
  "Vendas (Reserva)": "vendas_reserva",
  "Vendas (Total a Receber Cliente)": "vendas_total_receber_cliente",
  "Vendas (Emissor)": "vendas_emissor",
  "Vendas (Usuário Criação Reserva)": "vendas_usuario_criacao_reserva",
  "Vendas (Produto)": "vendas_produto",
  "Documento": "documento",
  "Tipo de Conta": "tipo_conta",
  "Banco / Carteira (Nome)": "banco_carteira_nome",
  "Dt.Recebimento": "dt_recebimento"
};

const mapFatura = {
  "Reserva": "reserva",
  "Cliente": "cliente",
  "Dt.Emissão": "dt_emissao",
  "Total Cliente": "total_cliente",
  "Situação Recebimento": "situacao_recebimento",
  "Produto": "c_custo",
  "Emissor": "emissor",
  "Total a Receber Cliente": "total_a_receber_cliente",
  "Situação": "situacao"
};

function formatExcelDate(serial) {
  if (!serial) return null;
  if (typeof serial === 'string') {
    if (serial.includes('/')) {
      const parts = serial.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return serial;
  }
  // Converter número serial Excel para Date (INTEIRAMENTE em UTC para evitar shift de timezone)
  // Excel epoch: 1900-01-01 = serial 1 (com bug do Lotus 1-2-3: 1900 é tratado como bissexto)
  const excelEpochMs = Date.UTC(1899, 11, 30); // 1899-12-30 em UTC
  const msPerDay = 86400000;
  const dateMs = excelEpochMs + Math.round(serial) * msPerDay;
  const d = new Date(dateMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function processExcelFile(file, typeMap, label, tableName, progressCallback) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onerror = (err) => {
      console.error('Erro ao ler arquivo:', err);
      reject(err);
    };

    reader.onload = async (e) => {
      try {
        if (progressCallback) progressCallback('Lendo Excel (aguarde)...');
        // Usar timeout para permitir que a UI atualize antes do bloqueio síncrono do XLSX
        await new Promise(r => setTimeout(r, 50));

        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let sheetName = "Planilha";
        if (!workbook.Sheets[sheetName]) {
          // Tentar usar a primeira aba disponível caso "Planilha" não exista (ex: "Planilha1")
          if (workbook.SheetNames.length > 0) {
            sheetName = workbook.SheetNames[0];
          } else {
            alert('Nenhuma aba encontrada no arquivo Excel!');
            return resolve();
          }
        }
        
        const sheet = workbook.Sheets[sheetName];
        if (progressCallback) progressCallback('Processando dados...');
        await new Promise(r => setTimeout(r, 50));
        
        const json = XLSX.utils.sheet_to_json(sheet, { range: 1, raw: true });
        
        const mappedData = [];
        let missingColumns = [];

        if (json.length > 0) {
          const fileHeaders = Object.keys(json[0]);
          for (const expectedKey of Object.keys(typeMap)) {
            if (!fileHeaders.includes(expectedKey)) {
              missingColumns.push(expectedKey);
            }
          }
        }

        if (missingColumns.length > 0) {
          console.warn(`[Aviso] Colunas não encontradas no Excel: ${missingColumns.join(', ')}`);
        }

        for (const row of json) {
          const newObj = {};
          let isEmpty = true;

          for (const [excelKey, supaKey] of Object.entries(typeMap)) {
            let val = row[excelKey];
            if (val !== undefined && val !== null && val !== "") {
              isEmpty = false;
              if (supaKey.includes('dt_') || supaKey.includes('data')) {
                val = formatExcelDate(val);
              }
              newObj[supaKey] = val;
            } else {
              newObj[supaKey] = null;
            }
          }
          
          if (!isEmpty) {
            mappedData.push(newObj);
          }
        }

        console.log(`[SUCESSO] ${label} - ${mappedData.length} linhas lidas do Excel. Iniciando upload para o Supabase...`);
        
        if (mappedData.length === 0) {
          alert('Nenhum dado válido encontrado para importar.');
          return resolve();
        }

        const firstKey = Object.values(typeMap)[0];
        
        if (progressCallback) progressCallback('Limpando tabela antiga...');
        const { error: delErr } = await supabase
          .from(tableName)
          .delete()
          .or(`${firstKey}.not.is.null,${firstKey}.is.null`);

        if (delErr) {
          console.warn(`Erro ao limpar tabela ${tableName} (pode estar vazia):`, delErr);
        }

        // LOTEAMENTO (Chunking) - Supabase falha com payloads massivos (ex: 110k registros)
        const CHUNK_SIZE = 2500;
        const totalChunks = Math.ceil(mappedData.length / CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
          if (progressCallback) progressCallback(`Enviando lote ${i + 1}/${totalChunks}...`);
          const chunk = mappedData.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          
          const { error: insertError } = await supabase
            .from(tableName)
            .insert(chunk);

          if (insertError) {
            throw new Error(`Erro ao inserir lote ${i + 1}: ${insertError.message || JSON.stringify(insertError)}`);
          }
        }

        if (progressCallback) progressCallback('Atualizando BI...');
        // Recarregar os dados na memória global do BI
        await carregarDados();

        alert(`Arquivo processado com sucesso!\n${mappedData.length} linhas gravadas na tabela '${tableName}'.`);
        resolve();

      } catch (error) {
        console.error(error);
        alert('Erro ao gravar no Supabase: ' + (error.message || JSON.stringify(error)));
        reject(error);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}


export function init() {
  // --- Logo Upload ---
  const btnSalvarLogo = document.getElementById('btn-salvar-logo');
  const btnRemoverLogo = document.getElementById('btn-remover-logo');
  const fileLogo = document.getElementById('file-logo');

  if (btnSalvarLogo) {
    btnSalvarLogo.addEventListener('click', () => {
      const file = fileLogo?.files[0];
      if (!file) return alert('Selecione uma imagem PNG ou JPG.');

      const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        return alert('Formato inválido. Use PNG ou JPG.');
      }

      // Max 2MB
      if (file.size > 2 * 1024 * 1024) {
        return alert('Imagem muito grande. Máximo 2MB.');
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result;
        try {
          localStorage.setItem('bi_empresa_logo', base64);
        } catch (err) {
          return alert('Erro ao salvar: imagem pode ser muito grande para o localStorage.');
        }

        // Update preview
        const previewContainer = document.getElementById('logo-preview-container');
        const previewImg = document.getElementById('logo-preview-img');
        const uploadArea = document.getElementById('logo-upload-area');
        if (previewImg) previewImg.src = base64;
        if (previewContainer) previewContainer.style.display = 'flex';
        if (uploadArea) uploadArea.style.display = 'none';

        // Refresh sidebar
        refreshSidebarLogo();
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnRemoverLogo) {
    btnRemoverLogo.addEventListener('click', () => {
      localStorage.removeItem('bi_empresa_logo');

      const previewContainer = document.getElementById('logo-preview-container');
      const uploadArea = document.getElementById('logo-upload-area');
      if (previewContainer) previewContainer.style.display = 'none';
      if (uploadArea) uploadArea.style.display = 'block';

      // Reset file input
      const fileLogo = document.getElementById('file-logo');
      if (fileLogo) fileLogo.value = '';

      // Refresh sidebar
      refreshSidebarLogo();
    });
  }

  // --- Import buttons ---
  const btnPagar = document.getElementById('btn-importar-pagar');
  const btnReceber = document.getElementById('btn-importar-receber');
  const btnFatura = document.getElementById('btn-importar-fatura');

  btnPagar.addEventListener('click', async () => {
    const file = document.getElementById('file-pagar').files[0];
    if (!file) return alert('Selecione um arquivo .xlsx para Base A Pagar');
    btnPagar.disabled = true;
    try {
      await processExcelFile(file, mapPagar, 'Base A Pagar', 'contas_pagar', (msg) => {
        btnPagar.textContent = msg;
      });
    } finally {
      btnPagar.disabled = false;
      btnPagar.textContent = 'Importar para Supabase';
    }
  });

  btnReceber.addEventListener('click', async () => {
    const file = document.getElementById('file-receber').files[0];
    if (!file) return alert('Selecione um arquivo .xlsx para Base A Receber');
    btnReceber.disabled = true;
    try {
      await processExcelFile(file, mapReceber, 'Base A Receber', 'contas_receber', (msg) => {
        btnReceber.textContent = msg;
      });
    } finally {
      btnReceber.disabled = false;
      btnReceber.textContent = 'Importar para Supabase';
    }
  });

  btnFatura.addEventListener('click', async () => {
    const file = document.getElementById('file-fatura').files[0];
    if (!file) return alert('Selecione um arquivo .xlsx para Base A Fatura');
    btnFatura.disabled = true;
    try {
      await processExcelFile(file, mapFatura, 'Base A Fatura', 'faturamento', (msg) => {
        btnFatura.textContent = msg;
      });
    } finally {
      btnFatura.disabled = false;
      btnFatura.textContent = 'Importar para Supabase';
    }
  });
}
