/* ── projects.js — New Project + Live Cost Calculator ─────── */

let _printers = [];
let _editId = null;

async function renderNewProject() {
  _editId = window._editProjectId || null;
  window._editProjectId = null;

  // Load printers for dropdown
  try { _printers = await api.get('/printers'); } catch { _printers = []; }

  let prefill = {};
  let editNote = '';
  if (_editId) {
    try {
      const proj = await api.get(`/projects/${_editId}`);
      prefill = { ...proj, ...(proj.inputs || {}) };
      editNote = `<div class="alert alert-info">EDITING PROJECT #${_editId}: ${escHtml(proj.name)}</div>`;
    } catch(e) {
      toast(`Could not load project: ${e.message}`, 'error');
      _editId = null;
    }
  }

  const printerOptions = _printers.map(p =>
    `<option value="${p.id}" ${prefill.printer_id == p.id ? 'selected' : ''}>${escHtml(p.name)} (${p.health_hours_remaining.toFixed(0)} hrs left)</option>`
  ).join('');

  const v = (k, def = '') => prefill[k] !== undefined ? escHtml(String(prefill[k])) : def;

  setPage(`<div class="animate-in">
    <div class="page-header">
      <div>
        <div class="page-title">${_editId ? 'Edit Project' : 'New Project'}</div>
        <div class="page-sub">${_editId ? `Editing project ID ${_editId}` : 'Create a new print job and calculate costs'}</div>
      </div>
      ${_editId ? `<button class="btn btn-ghost btn-sm" onclick="clearEdit()">× CANCEL EDIT</button>` : ''}
    </div>
    ${editNote}
    <div class="grid-2" style="gap:20px;align-items:start">
      <!-- Left: Form -->
      <div style="display:flex;flex-direction:column;gap:20px">

        <!-- Project Details -->
        <div class="card">
          <div class="form-section-title">Project Details</div>
          <div class="form-grid">
            <div class="form-group" style="grid-column:1/-1">
              <label>Project Name *</label>
              <input id="f-name" type="text" placeholder="e.g. Custom Robot Arm Part" value="${v('name')}"/>
            </div>
            <div class="form-group">
              <label>Client Name</label>
              <input id="f-client" type="text" placeholder="Client or personal" value="${v('client')}"/>
            </div>
            <div class="form-group">
              <label>Material Type</label>
              <select id="f-mattype">
                ${['PLA','PETG','ABS','TPU','ASA','Nylon','Resin','Other'].map(m =>
                  `<option ${v('material_type','PLA')===m?'selected':''}>${m}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group" style="grid-column:1/-1">
              <label>Description</label>
              <textarea id="f-desc" placeholder="Project description...">${v('description')}</textarea>
            </div>
            <div class="form-group">
              <label>Assign Printer</label>
              <select id="f-printer">
                <option value="">— None —</option>
                ${printerOptions}
              </select>
            </div>
            <div class="form-group" style="grid-column:1/-1">
              <label>Project Currency</label>
              <div class="alert alert-info" style="font-size:0.7rem;margin-bottom:0">
                 System is using global currency: <strong>${_settings.defaultCurrency || 'USD'} (${getSym(_settings.defaultCurrency)})</strong>. 
                 Change this in <a href="#settings">Settings</a>.
              </div>
            </div>
          </div>
        </div>

        <!-- Material -->
        <div class="card">
          <div class="form-section-title">Source Substrate — Material</div>
          <div class="form-grid">
            <div class="form-group"><label>Price / kg</label>
              <div class="input-with-unit"><input id="f-matPrice" type="number" placeholder="e.g. 20" value="${v('matPrice','20')}" step="0.01" min="0" onfocus="this.select()"><span class="input-unit" data-unit="/KG">/KG</span></div></div>
            <div class="form-group"><label>Net Print Weight</label>
              <div class="input-with-unit"><input id="f-printWeight" type="number" placeholder="e.g. 100" value="${v('printWeight','100')}" min="0" onfocus="this.select()"><span class="input-unit">G</span></div></div>
            <div class="form-group"><label>Support Structure Weight</label>
              <div class="input-with-unit"><input id="f-supportWeight" type="number" placeholder="e.g. 20" value="${v('supportWeight','20')}" min="0" onfocus="this.select()"><span class="input-unit">G</span></div></div>
            <div class="form-group"><label>Waste / Loss Ratio</label>
              <div class="input-with-unit"><input id="f-waste" type="number" placeholder="e.g. 5" value="${v('waste','5')}" min="0" max="100" step="0.1" onfocus="this.select()"><span class="input-unit">%</span></div></div>
          </div>
        </div>

        <!-- Electricity -->
        <div class="card">
          <div class="form-section-title">Power Grid — Electricity</div>
          <div class="form-grid-3">
            <div class="form-group"><label>Printer Draw Load</label>
              <div class="input-with-unit"><input id="f-watts" type="number" placeholder="e.g. 200" value="${v('watts','200')}" min="0" onfocus="this.select()"><span class="input-unit">W</span></div></div>
            <div class="form-group"><label>Print Duration</label>
              <div class="input-with-unit"><input id="f-printHours" type="number" placeholder="e.g. 5" value="${v('printHours','5')}" step="0.1" min="0" onfocus="this.select()"><span class="input-unit">HRS</span></div></div>
            <div class="form-group"><label>Grid Rate</label>
              <div class="input-with-unit"><input id="f-elecRate" type="number" placeholder="e.g. 0.15" value="${v('elecRate','0.15')}" step="0.01" min="0" onfocus="this.select()"><span class="input-unit" data-unit="/KWH">/KWH</span></div></div>
          </div>
        </div>

        <!-- Hardware -->
        <div class="card">
          <div class="form-section-title">Hardware Life — Machine</div>
          <div class="form-grid-3">
            <div class="form-group"><label>Printer Asset Cost</label>
              <div class="input-with-unit"><input id="f-printerCost" type="number" placeholder="e.g. 500" value="${v('printerCost','500')}" min="0"><span class="input-unit" data-unit=""></span></div></div>
            <div class="form-group"><label>Printer Operational Life</label>
              <div class="input-with-unit"><input id="f-printerLife" type="number" placeholder="e.g. 5000" value="${v('printerLife','5000')}" min="1"><span class="input-unit">HRS</span></div></div>
            <div class="form-group"><label>Monthly Maintenance</label>
              <div class="input-with-unit"><input id="f-maintMonth" type="number" placeholder="e.g. 10" value="${v('maintMonth','10')}" step="0.01" min="0"><span class="input-unit" data-unit="/MO">/MO</span></div></div>
          </div>
        </div>

        <!-- Labor -->
        <div class="card">
          <div class="form-section-title">Human Factor — Labor</div>
          <div class="form-grid-3">
            <div class="form-group"><label>Tech Rate</label>
              <div class="input-with-unit"><input id="f-laborRate" type="number" placeholder="e.g. 25" value="${v('laborRate','25')}" step="0.01" min="0"><span class="input-unit" data-unit="/HR">/HR</span></div></div>
            <div class="form-group"><label>Setup / Config Time</label>
              <div class="input-with-unit"><input id="f-setupTime" type="number" placeholder="e.g. 0.5" value="${v('setupTime','0.5')}" step="0.1" min="0"><span class="input-unit">HRS</span></div></div>
            <div class="form-group"><label>Post-Processing Time</label>
              <div class="input-with-unit"><input id="f-postTime" type="number" placeholder="e.g. 0.5" value="${v('postTime','0.5')}" step="0.1" min="0"><span class="input-unit">HRS</span></div></div>
          </div>
        </div>

        <!-- Market -->
        <div class="card">
          <div class="form-section-title">Market Risk — Business</div>
          <div class="form-grid">
            <div class="form-group"><label>Failure Risk</label>
              <div class="input-with-unit"><input id="f-failRisk" type="number" placeholder="e.g. 10" value="${v('failRisk','10')}" min="0" max="100"><span class="input-unit">%</span></div></div>
            <div class="form-group"><label>Packaging / Containment</label>
              <div class="input-with-unit"><input id="f-packaging" type="number" placeholder="e.g. 2" value="${v('packaging','2')}" step="0.01" min="0"><span class="input-unit" data-unit=""></span></div></div>
            <div class="form-group"><label>Shipping / Transit Fee</label>
              <div class="input-with-unit"><input id="f-shipping" type="number" placeholder="e.g. 10" value="${v('shipping','10')}" step="0.01" min="0"><span class="input-unit" data-unit=""></span></div></div>
            <div class="form-group"><label>Platform Fee</label>
              <div class="input-with-unit"><input id="f-platformFee" type="number" placeholder="e.g. 5" value="${v('platformFee','5')}" min="0" max="100"><span class="input-unit">%</span></div></div>
            <div class="form-group" style="grid-column:1/-1"><label>Profit Margin</label>
              <div class="input-with-unit"><input id="f-profitMargin" type="number" placeholder="e.g. 30" value="${v('profitMargin','30')}" min="0" max="1000"><span class="input-unit">%</span></div></div>
          </div>
        </div>

        <div class="btn-group">
          <button class="btn btn-primary" onclick="saveProject()">💾 SAVE PROJECT</button>
          <button class="btn btn-ghost" onclick="resetForm()">↺ RESET</button>
        </div>
      </div>

      <!-- Right: Live cost breakdown -->
      <div style="position:sticky;top:20px;display:flex;flex-direction:column;gap:20px">
        <div class="card card-mag">
          <div class="form-section-title">DATA OUTPUT — Live Breakdown</div>
          <div class="cost-breakdown" id="cost-panel">
            <div class="cost-row"><span class="clabel">MATERIAL COST</span><span class="cval" id="c-material">$0.00</span></div>
            <div class="cost-row"><span class="clabel">ELECTRICITY COST</span><span class="cval" id="c-electricity">$0.00</span></div>
            <div class="cost-row"><span class="clabel">HARDWARE DEPRECIATION</span><span class="cval" id="c-hardware">$0.00</span></div>
            <div class="cost-row"><span class="clabel">LABOR COST</span><span class="cval" id="c-labor">$0.00</span></div>
            <div class="cost-row"><span class="clabel">FAILURE RISK BUFFER</span><span class="cval" id="c-failure">$0.00</span></div>
            <div class="cost-row"><span class="clabel">PACKAGING</span><span class="cval" id="c-packaging">$0.00</span></div>
            <div class="cost-row"><span class="clabel">SHIPPING</span><span class="cval" id="c-shipping">$0.00</span></div>
            <div class="cost-row"><span class="clabel">──────────────</span><span></span></div>
            <div class="cost-row"><span class="clabel">SUBTOTAL</span><span class="cval" id="c-subtotal" style="color:var(--text-main)">$0.00</span></div>
            <div class="cost-row"><span class="clabel">PLATFORM FEE</span><span class="cval" id="c-platformFee">$0.00</span></div>
            <div class="cost-row"><span class="clabel">PROFIT MARGIN</span><span class="cval" id="c-profit" style="color:var(--neon-green)">$0.00</span></div>
            <div class="cost-row total-row">
              <span class="clabel">TOTAL PRICE</span>
              <span class="cval" id="c-total">$0.00</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="form-section-title">Printer Health Impact</div>
          <div id="printer-impact" style="font-size:.78rem;color:var(--text-dim);font-family:Orbitron,sans-serif;letter-spacing:1px">
            Select a printer and enter print hours to see impact.
          </div>
        </div>

        <div class="card card-green" style="border-left-color:var(--neon-green)">
          <div class="form-section-title" style="color:var(--neon-green)">QUICK GUIDE — README</div>
          <div style="font-size:0.7rem; color:var(--text-dim); line-height:1.4">
            <p class="mb-2"><strong>1. Material:</strong> Enter price per full KG spool. Waste % accounts for supports and purge lines.</p>
            <p class="mb-2"><strong>2. Electricity:</strong> Wattage is the average draw. Print duration calculates total KWH used.</p>
            <p class="mb-2"><strong>3. Hardware:</strong> Asset cost / Life hours = hourly rate. Wear is automatically deducted from Printer Health.</p>
            <p class="mb-2"><strong>4. Labor:</strong> Tech Rate applies to Setup and Post-processing only. Print time is considered passive.</p>
            <p><strong>5. Market:</strong> Platform fee applies to the final subtotal + failure risk.</p>
          </div>
        </div>
      </div>
    </div>
  </div>`);

  // Attach live-calc listeners
  document.querySelectorAll('#page-content input, #page-content select').forEach(el => {
    el.addEventListener('input', calcLive);
  });
  updateCurrencyLabels();
  calcLive();
}

function updateCurrencyLabels() {
  const code = _settings.defaultCurrency || 'USD';
  const sym = getSym(code);
  document.querySelectorAll('.input-unit[data-unit]').forEach(el => {
    el.textContent = sym + el.dataset.unit;
  });
  calcLive();
}

function gv(id) { return parseFloat(document.getElementById(id)?.value) || 0; }
function gs(id) { return document.getElementById(id)?.value || ''; }

function calcLive() {
  const code = _settings.defaultCurrency || 'USD';
  const sym  = getSym(code);
  const matPrice     = gv('f-matPrice');
  const printWeight  = gv('f-printWeight');
  const supportWeight= gv('f-supportWeight');
  const wastePct     = gv('f-waste');
  const watts        = gv('f-watts');
  const printHours   = gv('f-printHours');
  const elecRate     = gv('f-elecRate');
  const printerCost  = gv('f-printerCost');
  const printerLife  = gv('f-printerLife') || 1;
  const maintMonth   = gv('f-maintMonth');
  const laborRate    = gv('f-laborRate');
  const setupTime    = gv('f-setupTime');
  const postTime     = gv('f-postTime');
  const failRisk     = gv('f-failRisk');
  const packaging    = gv('f-packaging');
  const shipping     = gv('f-shipping');
  const platformFeePct= gv('f-platformFee');
  const profitPct    = gv('f-profitMargin');

  // Calculations
  let material = ((printWeight + supportWeight) / 1000) * matPrice;
  material += material * (wastePct / 100);

  const electricity = (watts / 1000) * printHours * elecRate;
  const depreciation = (printerCost / printerLife) * printHours;
  const maintPerHour = maintMonth / (30 * 24);
  const hardware = depreciation + maintPerHour * printHours;
  const labor = (setupTime + postTime) * laborRate;

  const subtotal = material + electricity + hardware + labor + packaging + shipping;
  const failure  = subtotal * (failRisk / 100);
  const subWithFailure = subtotal + failure;
  const platformFee = subWithFailure * (platformFeePct / 100);
  const profit = subWithFailure * (profitPct / 100);
  const total = subWithFailure + platformFee + profit;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = fmt(val, _settings.defaultCurrency || 'USD');
  };
  set('c-material', material);
  set('c-electricity', electricity);
  set('c-hardware', hardware);
  set('c-labor', labor);
  set('c-failure', failure);
  set('c-packaging', packaging);
  set('c-shipping', shipping);
  set('c-subtotal', subtotal);
  set('c-platformFee', platformFee);
  set('c-profit', profit);
  set('c-total', total);

  // Printer impact panel
  const printerId = gs('f-printer');
  if (printerId) {
    const p = _printers.find(pr => String(pr.id) === printerId);
    if (p) {
      const newHealth = p.health_hours_remaining - printHours;
      const col = newHealth < 0 ? 'var(--neon-magenta)' : newHealth < p.warning_threshold ? 'var(--neon-yellow)' : 'var(--neon-green)';
      document.getElementById('printer-impact').innerHTML = `
        <div style="margin-bottom:8px;color:var(--text-main)">${escHtml(p.name)}</div>
        <div style="font-size:.7rem;margin-bottom:4px">
          Health after print: <span style="color:${col};font-size:1rem">${Math.max(0, newHealth).toFixed(1)} hrs</span>
        </div>
        ${newHealth < 0 ? '<div class="alert alert-danger" style="margin-top:8px">⚠ EXCEEDS REMAINING HEALTH</div>' : ''}
        ${newHealth >= 0 && newHealth < p.warning_threshold ? '<div class="alert alert-warn" style="margin-top:8px">⚠ WILL FALL BELOW WARNING THRESHOLD</div>' : ''}
      `;
    }
  } else {
    document.getElementById('printer-impact').innerHTML = `<span style="font-size:.75rem;color:var(--text-dim)">Select a printer to see health impact.</span>`;
  }

  // Store for save
  window._currentCosts = { total_hours: printHours, material, electricity, hardware, labor, failure, packaging, shipping, subtotal, platformFee, profit, total };
}

async function saveProject() {
  const name = gs('f-name')?.trim();
  const client = gs('f-client')?.trim();
  const matPrice = gv('f-matPrice');
  const printWeight = gv('f-printWeight');
  const printHours = gv('f-printHours');

  // Strict Validation
  if (!name) return toast('Project name is required', 'error');
  if (matPrice < 0 || printWeight < 0 || printHours < 0) return toast('Values cannot be negative', 'error');
  if (printWeight === 0) return toast('Print weight is required', 'error');
  if (printHours === 0) return toast('Print duration is required', 'error');

  const costs = window._currentCosts || {};
  const inputs = {
    matPrice: gv('f-matPrice'), printWeight: gv('f-printWeight'), supportWeight: gv('f-supportWeight'),
    waste: gv('f-waste'), watts: gv('f-watts'), printHours: gv('f-printHours'), elecRate: gv('f-elecRate'),
    printerCost: gv('f-printerCost'), printerLife: gv('f-printerLife'), maintMonth: gv('f-maintMonth'),
    laborRate: gv('f-laborRate'), setupTime: gv('f-setupTime'), postTime: gv('f-postTime'),
    failRisk: gv('f-failRisk'), packaging: gv('f-packaging'), shipping: gv('f-shipping'),
    platformFee: gv('f-platformFee'), profitMargin: gv('f-profitMargin'),
    currency: _settings.defaultCurrency || 'USD',
  };

  const body = {
    name,
    client: gs('f-client'),
    description: gs('f-desc'),
    material_type: gs('f-mattype'),
    printer_id: gs('f-printer') ? Number(gs('f-printer')) : null,
    inputs,
    costs,
  };

  try {
    if (_editId) {
      await api.put(`/projects/${_editId}`, body);
      toast('Project updated!');
    } else {
      const proj = await api.post('/projects', body);
      toast('Project saved! ID: ' + proj.id);
      _editId = null;
    }
    window._editProjectId = null;
  } catch (e) {
    toast(e.message, 'error');
  }
}

function clearEdit() {
  _editId = null;
  window._editProjectId = null;
  renderNewProject();
}

function resetForm() {
  window._editProjectId = null;
  _editId = null;
  renderNewProject();
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
