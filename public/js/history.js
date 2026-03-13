/* ── history.js — Project History with filters + export ───── */

async function renderHistory() {
  setPage(`<div class="animate-in">
    <div class="page-header">
      <div><div class="page-title">Project History</div><div class="page-sub">All saved projects — filter, reopen, or delete</div></div>
      <div class="btn-group">
        <button class="btn btn-yellow btn-sm" onclick="exportCSV()">⬇ EXPORT CSV</button>
        <a href="#new-project" class="btn btn-primary btn-sm">＋ NEW</a>
      </div>
    </div>

    <div class="card mb-6">
      <div class="filter-bar">
        <input id="hist-search" type="text" placeholder="Search by name or client..." oninput="historySearch()"/>
        <input id="hist-from" type="date" onchange="historySearch()"/>
        <span style="color:var(--text-dim);font-size:.8rem">to</span>
        <input id="hist-to" type="date" onchange="historySearch()"/>
        <button class="btn btn-ghost btn-sm" onclick="clearHistFilters()">CLEAR</button>
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Project</th><th>Client</th><th>Material</th>
            <th>Print Hrs</th><th>Total Cost</th><th>Status</th><th>Date</th><th>Actions</th>
          </tr></thead>
          <tbody id="hist-tbody"><tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-dim);font-family:Orbitron,sans-serif;font-size:.65rem;letter-spacing:2px">LOADING...</td></tr></tbody>
        </table>
      </div>
      <div id="hist-count" style="margin-top:12px;font-size:.7rem;color:var(--text-dim);font-family:Orbitron,sans-serif;letter-spacing:1px"></div>
    </div>
  </div>`);

  await loadHistory();
}

let _histProjects = [];

async function loadHistory(params = {}) {
  try {
    const qs = new URLSearchParams(params).toString();
    _histProjects = await api.get('/projects' + (qs ? '?' + qs : ''));
    renderHistTable(_histProjects);
  } catch (e) {
    document.getElementById('hist-tbody').innerHTML =
      `<tr><td colspan="9"><div class="alert alert-danger">${e.message}</div></td></tr>`;
  }
}

function renderHistTable(projects) {
  const tbody = document.getElementById('hist-tbody');
  const count = document.getElementById('hist-count');
  if (!projects.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-dim);font-family:Orbitron,sans-serif;font-size:.65rem;letter-spacing:2px">NO PROJECTS FOUND</td></tr>';
    if (count) count.textContent = '';
    return;
  }
  tbody.innerHTML = projects.map(p => {
    const costs = p.costs || {};
    const inputs = p.inputs || {};
    return `<tr>
      <td style="color:var(--text-dim);font-family:Orbitron,sans-serif;font-size:.7rem">${p.id}</td>
      <td><strong>${escHistHtml(p.name)}</strong>${p.description ? `<div style="font-size:.72rem;color:var(--text-dim);margin-top:2px">${escHistHtml(p.description).substring(0,50)}...</div>` : ''}</td>
      <td>${escHistHtml(p.client) || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span style="font-family:Orbitron,sans-serif;font-size:.65rem;color:var(--neon-cyan)">${escHistHtml(p.material_type)}</span></td>
      <td style="font-family:Orbitron,sans-serif">${(inputs.printHours || 0).toFixed(1)}h</td>
      <td><strong style="color:var(--neon-green);font-family:Orbitron,sans-serif">${fmt(costs.total || 0)}</strong></td>
      <td><span class="badge badge-${p.invoice_status || 'none'}">${p.invoice_status || 'PENDING'}</span></td>
      <td style="font-size:.75rem;color:var(--text-dim)">${fmtDate(p.created_at)}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline" onclick="reopenProject(${p.id})">EDIT</button>
          <button class="btn btn-sm btn-ghost" onclick="duplicateProject(${p.id})">COPY</button>
          <button class="btn btn-sm btn-yellow" onclick="goInvoice(${p.id})">INVOICE</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProject(${p.id},'${escHistHtml(p.name)}')">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  if (count) count.textContent = `${projects.length} PROJECT${projects.length !== 1 ? 'S' : ''} FOUND`;
}

const historySearch = debounce(async () => {
  const q = document.getElementById('hist-search')?.value?.trim();
  const from = document.getElementById('hist-from')?.value;
  const to = document.getElementById('hist-to')?.value;
  const params = {};
  if (q) params.q = q;
  if (from) params.from = from;
  if (to) params.to = to;
  await loadHistory(params);
}, 350);

function clearHistFilters() {
  ['hist-search','hist-from','hist-to'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  loadHistory();
}

function reopenProject(id) {
  window._editProjectId = id;
  location.hash = 'new-project';
}

function goInvoice(id) {
  window._invoiceProjectId = id;
  location.hash = 'invoices';
}

async function duplicateProject(id) {
  try {
    await api.post(`/projects/${id}/duplicate`);
    toast('Project duplicated!');
    loadHistory();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteProject(id, name) {
  modal.open({
    title: 'Delete Project',
    body: `<p style="font-size:.85rem;color:var(--text-main)">Are you sure you want to delete <strong style="color:var(--neon-magenta)">${escHistHtml(name)}</strong>?<br><span style="color:var(--text-dim);font-size:.75rem">This cannot be undone.</span></p>`,
    footer: `
      <button class="btn btn-ghost" onclick="modal.close()">CANCEL</button>
      <button class="btn btn-danger" onclick="confirmDelete(${id})">DELETE</button>
    `,
  });
}

window.confirmDelete = async (id) => {
  try {
    await api.delete(`/projects/${id}`);
    modal.close();
    toast('Project deleted');
    await loadHistory();
  } catch(e) { toast(e.message, 'error'); }
};

function exportCSV() {
  if (!_histProjects.length) { toast('No projects to export', 'warn'); return; }
  const headers = ['ID','Name','Client','Material','Print Hrs','Material Cost','Electricity Cost','Labor Cost','Packaging','Shipping','Platform Fee','Profit','Total','Status','Created'];
  const rows = _histProjects.map(p => {
    const c = p.costs || {};
    const i = p.inputs || {};
    return [
      p.id, `"${p.name}"`, `"${p.client || ''}"`, p.material_type || '',
      (i.printHours || 0).toFixed(2),
      (c.material||0).toFixed(2),(c.electricity||0).toFixed(2),(c.labor||0).toFixed(2),
      (c.packaging||0).toFixed(2),(c.shipping||0).toFixed(2),(c.platformFee||0).toFixed(2),
      (c.profit||0).toFixed(2),(c.total||0).toFixed(2),
      p.invoice_status || 'pending', p.created_at,
    ].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `projects_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast('CSV exported!');
}

function escHistHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
