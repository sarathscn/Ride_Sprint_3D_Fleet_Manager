/* ── invoice.js — Invoice generator + PDF download ──────── */

let _allProjects = [];
let _selectedProjects = []; // Array of { id, qty }

async function renderInvoices() {
  setPage(`<div class="animate-in">
    <div class="page-header">
      <div><div class="page-title">Invoices</div><div class="page-sub">Generate, preview, and download PDF invoices</div></div>
    </div>
    <div class="grid-2" style="gap:20px;align-items:start">
      <!-- Generator -->
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="card">
          <div class="form-section-title">Generate Invoice</div>
          <div class="form-group mb-6">
            <label>Add Project to Invoice</label>
            <div style="display:flex;gap:10px">
              <select id="inv-project-select" style="flex:1"><option value="">Loading projects...</option></select>
              <button class="btn btn-yellow" onclick="addProjectToInvoice()">＋ ADD</button>
            </div>
          </div>
          
          <div id="selected-projects-list" style="margin-bottom:20px;display:flex;flex-direction:column;gap:10px">
            <!-- Selected projects will appear here -->
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Discount Type</label>
              <select id="inv-disc-type" onchange="updateInvPreview()">
                <option value="flat">Flat Amount (${getSym()})</option>
                <option value="percent">Percentage (%)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Discount Value</label>
              <div class="input-with-unit">
                <input id="inv-disc-val" type="number" value="0" min="0" step="0.01" oninput="updateInvPreview()" onfocus="this.select()">
                <span class="input-unit" id="inv-disc-unit">${getSym()}</span>
              </div>
            </div>
          </div>
          <div class="mt-6">
            <div class="form-section-title">Visibility Controls</div>
            <div id="inv-visibility-toggles" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:16px">
              <!-- Toggles will be injected here -->
            </div>
            
            <div class="cost-breakdown mt-4">
              <div class="cost-row"><span class="clabel">SUBTOTAL</span><span class="cval" id="inv-subtotal">...</span></div>
              <div class="cost-row"><span class="clabel">DISCOUNT</span><span class="cval" id="inv-discount" style="color:var(--neon-magenta)">...</span></div>
              <div class="cost-row total-row"><span class="clabel">FINAL TOTAL</span><span class="cval" id="inv-final">...</span></div>
            </div>
            
            <div class="btn-group mt-6">
              <button class="btn btn-primary w-full" style="justify-content:center" onclick="createAndDownloadInvoice()">⬇ GENERATE &amp; DOWNLOAD PDF</button>
            </div>
          </div>
        </div>

        <!-- Existing invoices -->
        <div class="card">
          <div class="form-section-title">Invoice History</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Invoice</th><th>Project</th><th>Client</th><th>Discount</th><th>Total</th><th>Date</th><th>PDF</th></tr></thead>
              <tbody id="inv-history-tbody"><tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-dim);font-family:Orbitron,sans-serif;font-size:.65rem;letter-spacing:2px">LOADING...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Preview -->
      <div>
        <div class="card" style="padding:0;overflow:hidden">
          <div class="form-section-title" style="padding:16px;margin:0;border-bottom:1px solid var(--border)">INVOICE PREVIEW</div>
          <div id="inv-preview" style="padding:20px;min-height:300px">
            <div style="text-align:center;padding:60px 20px;color:var(--text-dim);font-family:Orbitron,sans-serif;font-size:.65rem;letter-spacing:2px">
              SELECT A PROJECT TO PREVIEW INVOICE
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`);

  await loadInvProjects();
  await loadInvHistory();

  document.getElementById('inv-disc-type').addEventListener('change', () => {
    const t = document.getElementById('inv-disc-type').value;
    document.getElementById('inv-disc-unit').textContent = t === 'percent' ? '%' : getSym();
    updateInvPreview();
  });

  // Auto-select if coming from history
  if (window._invoiceProjectId) {
    _selectedProjects = [{ id: Number(window._invoiceProjectId), qty: 1 }];
    window._invoiceProjectId = null;
    updateInvPreview();
  }
}

async function loadInvProjects() {
  try {
    _allProjects = await api.get('/projects');
    const sel = document.getElementById('inv-project-select');
    sel.innerHTML = `<option value="">— Select a project —</option>` +
      _allProjects.map(p => `<option value="${p.id}">[#${p.id}] ${escInvHtml(p.name)}</option>`).join('');
  } catch(e) {
    toast('Could not load projects: ' + e.message, 'error');
  }
}

function addProjectToInvoice() {
  const sel = document.getElementById('inv-project-select');
  const idValue = sel.value;
  if (!idValue) return;
  const id = Number(idValue);
  
  if (_selectedProjects.find(p => p.id === id)) {
    toast('Project already added', 'warn');
    return;
  }
  
  _selectedProjects.push({ id, qty: 1 });
  updateInvPreview();
}

function removeProjectFromInvoice(id) {
  _selectedProjects = _selectedProjects.filter(p => p.id !== id);
  updateInvPreview();
}

function updateProjectQty(id, qty) {
  const p = _selectedProjects.find(item => item.item_id === id || item.id === id);
  if (p) p.qty = Math.max(1, parseInt(qty) || 1);
  // We use a small delay or flag to avoid immediate redraw if we want to keep focus
  // But for now, let's just redraw and we will fix focus in updateInvPreview
  window._lastFocusedQtyId = id;
  updateInvPreview();
}

async function loadInvHistory() {
  try {
    const invoices = await api.get('/invoices');
    const tbody = document.getElementById('inv-history-tbody');
    if (!invoices.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-dim);font-family:Orbitron,sans-serif;font-size:.65rem;letter-spacing:2px">NO INVOICES YET</td></tr>';
      return;
    }
    tbody.innerHTML = invoices.map(inv => `<tr>
      <td style="color:var(--text-dim);font-family:Orbitron,sans-serif;font-size:.7rem">${inv.id}</td>
      <td style="font-family:Orbitron,sans-serif;font-size:.65rem;color:var(--neon-cyan)">${inv.invoice_number}</td>
      <td>${escInvHtml(inv.project_name)}</td>
      <td>${escInvHtml(inv.client) || '—'}</td>
      <td style="font-size:.75rem;color:var(--neon-magenta)">
        ${inv.discount_value > 0 ? `${inv.discount_type === 'percent' ? inv.discount_value + '%' : getSym() + Number(inv.discount_value).toFixed(2)}` : '—'}
      </td>
      <td style="font-family:Orbitron,sans-serif;color:var(--neon-green);font-weight:700">${fmt(inv.final_total)}</td>
      <td style="font-size:.75rem;color:var(--text-dim)">${fmtDate(inv.issued_at)}</td>
      <td><a href="/api/invoices/${inv.id}/pdf" target="_blank" class="btn btn-sm btn-outline">⬇ PDF</a></td>
    </tr>`).join('');
  } catch(e) {
    document.getElementById('inv-history-tbody').innerHTML = `<tr><td colspan="8"><div class="alert alert-danger">${e.message}</div></td></tr>`;
  }
}

function updateInvPreview() {
  const listEl = document.getElementById('selected-projects-list');
  if (!listEl) return;
  
  if (!_selectedProjects.length) {
    listEl.innerHTML = `<div style="text-align:center;padding:10px;color:var(--text-dim);font-size:0.7rem;border:1px dashed var(--border)">NO PROJECTS ADDED</div>`;
    document.getElementById('inv-preview').innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-dim);font-family:Orbitron,sans-serif;font-size:.65rem;letter-spacing:2px">ADD PROJECTS TO PREVIEW INVOICE</div>`;
    document.getElementById('inv-subtotal').textContent = fmt(0);
    document.getElementById('inv-discount').textContent = `-${fmt(0)}`;
    document.getElementById('inv-final').textContent = fmt(0);
    return;
  }

  let subtotal = 0;
  listEl.innerHTML = _selectedProjects.map(item => {
    const p = _allProjects.find(proj => proj.id === item.id);
    if (!p) return '';
    const costs = JSON.parse(p.costs_json || '{}');
    const itemTotal = (costs.total || 0) * item.qty;
    subtotal += itemTotal;
    
    return `
      <div class="card" style="padding:10px;display:flex;justify-content:space-between;align-items:center;border-left-width:2px;background:rgba(255,255,255,0.02)">
        <div style="flex:1">
          <div style="font-size:0.75rem;font-weight:700;color:var(--neon-cyan)">${escInvHtml(p.name)}</div>
          <div style="font-size:0.6rem;color:var(--text-dim)">${escInvHtml(p.client || '—')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="form-group" style="width:60px">
            <input type="number" id="qty-input-${p.id}" value="${item.qty}" min="1" oninput="updateProjectQty(${p.id}, this.value)" style="padding:4px;font-size:0.7rem;text-align:center">
          </div>
          <div style="font-size:0.75rem;font-weight:700;width:80px;text-align:right">${fmt(itemTotal)}</div>
          <button class="btn btn-sm btn-danger" onclick="removeProjectFromInvoice(${p.id})">×</button>
        </div>
      </div>
    `;
  }).join('');

  const discType = document.getElementById('inv-disc-type')?.value || 'flat';
  const discVal = parseFloat(document.getElementById('inv-disc-val')?.value) || 0;
  const discAmt = discType === 'percent' ? subtotal * (discVal / 100) : discVal;
  const finalTotal = Math.max(0, subtotal - discAmt);

  document.getElementById('inv-subtotal').textContent = fmt(subtotal);
  document.getElementById('inv-discount').textContent = `-${fmt(discAmt)}`;
  document.getElementById('inv-final').textContent = fmt(finalTotal);

  // Handle visibility toggles
  const costKeys = [
    { key: 'material', label: 'Material Detail' },
    { key: 'electricity', label: 'Electricity' },
    { key: 'hardware', label: 'Machine Depr.' },
    { key: 'labor', label: 'Labor Factor' },
    { key: 'packaging', label: 'Packaging' },
    { key: 'shipping', label: 'Shipping' },
    { key: 'platformFee', label: 'Service Fee' },
    { key: 'profit', label: 'Profit Margin' }
  ];

  const toggleWrap = document.getElementById('inv-visibility-toggles');
  if (toggleWrap && !toggleWrap.dataset.init) {
    toggleWrap.innerHTML = costKeys.map(k => `
      <div class="inv-toggle-item">
        <input type="checkbox" id="v-toggle-${k.key}" checked onchange="updateInvPreview()">
        <label for="v-toggle-${k.key}">${k.label}</label>
      </div>
    `).join('');
    toggleWrap.dataset.init = "true";
  }

  const hiddenFields = costKeys.filter(k => {
    const el = document.getElementById(`v-toggle-${k.key}`);
    return el && !el.checked;
  }).map(k => k.label);

  api.get('/settings').then(s => {
    const today = new Date().toLocaleDateString();
    const primary = _allProjects.find(p => p.id === _selectedProjects[0].id) || {};

    document.getElementById('inv-preview').innerHTML = `
      <div class="invoice-preview">
        <div class="inv-header">
          <div>
            ${s.companyLogo && s.companyLogo.startsWith('data:image') ? `<img src="${s.companyLogo}" class="inv-logo" />` : `<img src="/ride_sprint_logo_v2_1773323382197.png" class="inv-logo" />`}
          </div>
          <div style="text-align:right">
            <h1>INVOICE</h1>
            <div class="inv-company">${s.companyName || 'Ride Sprint 3D'}<br>${s.companySlogan || 'Professional 3D Printing'}<br>${s.companyEmail || 'contact@ridesprint3d.com'}</div>
          </div>
        </div>

      <table class="inv-meta">
        <tr><td>Invoice #:</td><td><strong>PREVIEW-${Date.now().toString().slice(-5)}</strong></td></tr>
        <tr><td>Date:</td><td>${today}</td></tr>
        <tr><td>Client:</td><td>${escInvHtml(primary.client || 'Valued Customer')}</td></tr>
      </table>

      <table class="inv-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Mat.</th>
            <th style="text-align:center">Qty</th>
            <th style="text-align:right">Unit Price</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${_selectedProjects.map(item => {
            const p = _allProjects.find(proj => proj.id === item.id);
            if (!p) return '';
            const costs = JSON.parse(p.costs_json || '{}');
            const breakdown = [
              { label: 'Material Detail', val: costs.material },
              { label: 'Electricity', val: costs.electricity },
              { label: 'Machine Depr.', val: costs.hardware },
              { label: 'Labor Factor', val: costs.labor },
              { label: 'Packaging', val: costs.packaging },
              { label: 'Shipping', val: costs.shipping },
              { label: 'Service Fee', val: costs.platformFee },
              { label: 'Profit Margin', val: costs.profit }
            ].filter(b => !hiddenFields.includes(b.label));

            return `
              <tr>
                <td>
                  <strong>${escInvHtml(p.name)}</strong>
                  ${p.description ? `<div style="font-size:0.7rem;color:#888">${escInvHtml(p.description)}</div>` : ''}
                  <div style="font-size:0.65rem;color:#999;margin-top:4px">
                    ${breakdown.map(b => `<span style="margin-right:8px">${b.label}: ${fmt(b.val * item.qty)}</span>`).join('')}
                  </div>
                </td>
                <td>${p.material_type || 'PLA'}</td>
                <td style="text-align:center">${item.qty}</td>
                <td style="text-align:right">${fmt(costs.total)}</td>
                <td style="text-align:right">${fmt(costs.total * item.qty)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

        <div class="inv-total">TOTAL DUE: ${fmt(finalTotal)}</div>
      </div>
      <div style="margin-top:30px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px">
        Thank you for your business — ${s.companyName || 'Ride Sprint 3D'}
      </div>
    </div>`;

    // Restore focus if needed
    if (window._lastFocusedQtyId) {
      const el = document.getElementById(`qty-input-${window._lastFocusedQtyId}`);
      if (el) {
        el.focus();
        // Move cursor to end for number inputs
        const val = el.value;
        el.value = '';
        el.value = val;
      }
      window._lastFocusedQtyId = null;
    }
  });
}

async function createAndDownloadInvoice() {
  if (!_selectedProjects.length) { toast('Add at least one project', 'error'); return; }

  const discType = document.getElementById('inv-disc-type')?.value || 'flat';
  const discVal = parseFloat(document.getElementById('inv-disc-val')?.value) || 0;

  try {
    const hiddenFields = [
      { key: 'material', label: 'Material Detail' },
      { key: 'electricity', label: 'Electricity' },
      { key: 'hardware', label: 'Machine Depr.' },
      { key: 'labor', label: 'Labor Factor' },
      { key: 'packaging', label: 'Packaging' },
      { key: 'shipping', label: 'Shipping' },
      { key: 'platformFee', label: 'Service Fee' },
      { key: 'profit', label: 'Profit Margin' }
    ].filter(k => {
      const el = document.getElementById(`v-toggle-${k.key}`);
      return el && !el.checked;
    }).map(k => k.label);

    const invoice = await api.post('/invoices', {
      projects: _selectedProjects,
      discount_type: discType,
      discount_value: discVal,
      hidden_fields: hiddenFields
    });
    toast(`Invoice ${invoice.invoice_number} created!`);
    // Download PDF
    window.open(`/api/invoices/${invoice.id}/pdf`, '_blank');
    _selectedProjects = [];
    await loadInvHistory();
    updateInvPreview();
  } catch(e) {
    toast(e.message, 'error');
  }
}

function escInvHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
