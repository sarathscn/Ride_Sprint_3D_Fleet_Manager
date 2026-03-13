/* ── printer.js — Printer Health Tracking ───────────────── */

async function renderPrinter() {
  setPage(`<div class="animate-in">
    <div class="page-header">
      <div><div class="page-title">Printer Health</div><div class="page-sub">Track usage, depreciation, and maintenance windows</div></div>
      <button class="btn btn-primary" onclick="showAddPrinterModal()">＋ ADD PRINTER</button>
    </div>
    <div id="printer-list"><div class="pulse text-dim" style="padding:40px 0;text-align:center;font-family:Orbitron,sans-serif;font-size:.7rem;letter-spacing:2px">LOADING PRINTERS...</div></div>
  </div>`);
  await loadPrinters();
}

async function loadPrinters() {
  try {
    const printers = await api.get('/printers');
    const el = document.getElementById('printer-list');
    if (!printers.length) {
      el.innerHTML = `
        <div class="card" style="text-align:center;padding:48px">
          <div style="font-family:Orbitron,sans-serif;font-size:.75rem;color:var(--text-dim);letter-spacing:2px;margin-bottom:20px">NO PRINTERS CONFIGURED</div>
          <button class="btn btn-primary" onclick="showAddPrinterModal()">＋ ADD YOUR FIRST PRINTER</button>
        </div>`;
      return;
    }

    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:20px">
      ${printers.map(p => printerCard(p)).join('')}
    </div>`;
  } catch(e) {
    document.getElementById('printer-list').innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

function printerCard(p) {
  const pct = p.total_lifetime_hrs > 0 ? Math.max(0, Math.min(100, (p.health_hours_remaining / p.total_lifetime_hrs) * 100)) : 0;
  const col = pct > 30 ? 'var(--neon-green)' : pct > 10 ? 'var(--neon-yellow)' : 'var(--neon-magenta)';
  const usedHrs = p.total_lifetime_hrs - p.health_hours_remaining;
  const isWarning = p.health_hours_remaining <= p.warning_threshold;
  const isDanger  = p.health_hours_remaining <= 0;

  return `
    <div class="card ${isDanger ? 'card-mag' : isWarning ? 'card-yellow' : ''}">
      ${isDanger  ? `<div class="alert alert-danger" style="margin-bottom:12px">⛔ MAINTENANCE OVERDUE — PRINTER AT ZERO HEALTH</div>` : ''}
      ${isWarning && !isDanger ? `<div class="alert alert-warn" style="margin-bottom:12px">⚠ LOW HEALTH — ${p.health_hours_remaining.toFixed(0)} HRS REMAINING</div>` : ''}

      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div>
          <div style="font-family:Orbitron,sans-serif;font-size:1rem;font-weight:700;color:var(--neon-yellow)">${escPrHtml(p.name)}</div>
          <div style="font-size:.7rem;color:var(--text-dim);margin-top:4px">Added ${fmtDate(p.created_at)}</div>
        </div>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline" onclick="showEditPrinterModal(${p.id})">EDIT</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeletePrinter(${p.id},'${escPrHtml(p.name)}')">✕</button>
        </div>
      </div>

      <div class="health-label">
        <span>HEALTH</span>
        <span style="color:${col}">${p.health_hours_remaining.toFixed(1)} hrs remaining</span>
      </div>
      <div class="health-gauge">
        <div class="health-bar" style="width:${pct.toFixed(1)}%;background:${col}"></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:16px">
        ${miniStat('TOTAL LIFE', p.total_lifetime_hrs.toFixed(0) + ' hrs')}
        ${miniStat('HOURS USED', usedHrs.toFixed(1) + ' hrs')}
        ${miniStat('WARN BELOW', p.warning_threshold.toFixed(0) + ' hrs')}
      </div>

      <div style="margin-top:16px">
        <div class="form-section-title">Manual Hour Deduction</div>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="input-with-unit" style="flex:1">
            <input id="deduct-hrs-${p.id}" type="number" min="0.1" step="0.1" value="1" placeholder="Hours to deduct" onfocus="this.select()">
            <span class="input-unit">HRS</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="deductHours(${p.id})">DEDUCT</button>
        </div>
      </div>

      <div style="margin-top:12px">
        <div style="width:100%;background:rgba(255,255,255,0.04);height:4px;position:relative">
          <div style="width:${pct.toFixed(1)}%;height:100%;background:${col};transition:width .5s ease"></div>
        </div>
        <div style="font-family:Orbitron,sans-serif;font-size:.6rem;color:var(--text-muted);margin-top:4px;text-align:right">${pct.toFixed(1)}% health remaining</div>
      </div>
    </div>`;
}

function miniStat(label, value) {
  return `<div style="background:rgba(255,255,255,0.03);padding:10px;text-align:center">
    <div style="font-family:Orbitron,sans-serif;font-size:0.55rem;color:var(--text-dim);letter-spacing:1px;margin-bottom:4px">${label}</div>
    <div style="font-family:Orbitron,sans-serif;font-size:0.85rem;font-weight:700;color:var(--text-main)">${value}</div>
  </div>`;
}

function showAddPrinterModal() {
  modal.open({
    title: 'Add Printer Profile',
    body: `
      <div class="form-group mb-4"><label>Printer Name *</label><input id="pm-name" type="text" placeholder="e.g. Bambu Lab X1C" onfocus="this.select()"/></div>
      <div class="form-grid">
        <div class="form-group"><label>Total Lifetime Hours</label><div class="input-with-unit"><input id="pm-total" type="number" value="5000" min="1" onfocus="this.select()"><span class="input-unit">HRS</span></div></div>
        <div class="form-group"><label>Current Health Remaining</label><div class="input-with-unit"><input id="pm-health" type="number" value="5000" min="0" onfocus="this.select()"><span class="input-unit">HRS</span></div></div>
        <div class="form-group"><label>Warning Threshold</label><div class="input-with-unit"><input id="pm-warn" type="number" value="100" min="0" onfocus="this.select()"><span class="input-unit">HRS</span></div></div>
      </div>`,
    footer: `
      <button class="btn btn-ghost" onclick="modal.close()">CANCEL</button>
      <button class="btn btn-primary" onclick="savePrinter()">SAVE PRINTER</button>`,
  });
}

function showEditPrinterModal(id) {
  api.get('/printers').then(printers => {
    const p = printers.find(pr => pr.id === id);
    if (!p) return;
    modal.open({
      title: 'Edit Printer Profile',
      body: `
        <div class="form-group mb-4"><label>Printer Name *</label><input id="pm-name" type="text" value="${escPrHtml(p.name)}"/></div>
        <div class="form-grid">
          <div class="form-group"><label>Total Lifetime Hours</label><div class="input-with-unit"><input id="pm-total" type="number" value="${p.total_lifetime_hrs}" min="1"><span class="input-unit">HRS</span></div></div>
          <div class="form-group"><label>Current Health Remaining</label><div class="input-with-unit"><input id="pm-health" type="number" value="${p.health_hours_remaining}" min="0"><span class="input-unit">HRS</span></div></div>
          <div class="form-group"><label>Warning Threshold</label><div class="input-with-unit"><input id="pm-warn" type="number" value="${p.warning_threshold}" min="0"><span class="input-unit">HRS</span></div></div>
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="modal.close()">CANCEL</button>
        <button class="btn btn-primary" onclick="updatePrinter(${id})">UPDATE</button>`,
    });
  });
}

async function savePrinter() {
  const name = document.getElementById('pm-name')?.value?.trim();
  if (!name) { toast('Printer name required', 'error'); return; }
  const total = parseFloat(document.getElementById('pm-total')?.value) || 5000;
  const health = parseFloat(document.getElementById('pm-health')?.value) ?? total;
  const warn = parseFloat(document.getElementById('pm-warn')?.value) || 100;
  try {
    await api.post('/printers', { name, total_lifetime_hrs: total, health_hours_remaining: health, warning_threshold: warn });
    modal.close();
    toast('Printer added!');
    await loadPrinters();
  } catch(e) { toast(e.message, 'error'); }
}

async function updatePrinter(id) {
  const name = document.getElementById('pm-name')?.value?.trim();
  if (!name) { toast('Printer name required', 'error'); return; }
  const total = parseFloat(document.getElementById('pm-total')?.value) || 5000;
  const health = parseFloat(document.getElementById('pm-health')?.value) ?? total;
  const warn = parseFloat(document.getElementById('pm-warn')?.value) || 100;
  try {
    await api.put(`/printers/${id}`, { name, total_lifetime_hrs: total, health_hours_remaining: health, warning_threshold: warn });
    modal.close();
    toast('Printer updated!');
    await loadPrinters();
  } catch(e) { toast(e.message, 'error'); }
}

async function deductHours(id) {
  const hrs = parseFloat(document.getElementById(`deduct-hrs-${id}`)?.value);
  if (!hrs || hrs <= 0) { toast('Enter valid hours to deduct', 'warn'); return; }
  try {
    const printers = await api.get('/printers');
    const p = printers.find(pr => pr.id === id);
    if (!p) return;
    await api.put(`/printers/${id}`, {
      name: p.name,
      total_lifetime_hrs: p.total_lifetime_hrs,
      health_hours_remaining: Math.max(0, p.health_hours_remaining - hrs),
      warning_threshold: p.warning_threshold,
    });
    toast(`Deducted ${hrs}h from ${p.name}`);
    await loadPrinters();
  } catch(e) { toast(e.message, 'error'); }
}

function confirmDeletePrinter(id, name) {
  modal.open({
    title: 'Delete Printer',
    body: `<p style="font-size:.85rem;color:var(--text-main)">Delete printer <strong style="color:var(--neon-magenta)">${escPrHtml(name)}</strong>?<br><span style="color:var(--text-dim);font-size:.75rem">Projects using this printer will have their printer reference cleared.</span></p>`,
    footer: `<button class="btn btn-ghost" onclick="modal.close()">CANCEL</button>
             <button class="btn btn-danger" onclick="doDeletePrinter(${id})">DELETE</button>`,
  });
}

window.doDeletePrinter = async (id) => {
  try {
    await api.delete(`/printers/${id}`);
    modal.close();
    toast('Printer deleted');
    await loadPrinters();
  } catch(e) { toast(e.message, 'error'); }
};

function escPrHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
