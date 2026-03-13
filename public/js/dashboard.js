/* ── dashboard.js ─────────────────────────────────────────── */
async function renderDashboard() {
  setPage(`<div class="animate-in">
    <div class="page-header">
      <div><div class="page-title">Dashboard</div><div class="page-sub">System overview &amp; recent activity</div></div>
      <a href="#new-project" class="btn btn-primary">＋ NEW PROJECT</a>
    </div>
    <div id="dash-content"><div class="pulse text-dim" style="padding:40px 0;text-align:center;font-family:Orbitron,sans-serif;font-size:.7rem;letter-spacing:2px;">LOADING SYSTEM DATA...</div></div>
  </div>`);

  try {
    const d = await api.get('/dashboard');

    // Printer warnings
    const warnings = (d.printers || [])
      .filter(p => p.health_hours_remaining <= p.warning_threshold)
      .map(p => `<div class="alert alert-${p.health_hours_remaining <= 0 ? 'danger' : 'warn'}">
        ⚠ PRINTER "${p.name.toUpperCase()}" — ${p.health_hours_remaining <= 0 ? 'MAINTENANCE OVERDUE' : `HEALTH LOW: ${p.health_hours_remaining.toFixed(0)} HRS REMAINING`}
      </div>`).join('');

    // Recent projects table rows
    const rows = (d.recent_projects || []).map(p => {
      const total = p.costs?.total || 0;
      return `<tr>
        <td><strong>${escHtml(p.name)}</strong></td>
        <td>${escHtml(p.client || '—')}</td>
        <td>${fmtDate(p.created_at)}</td>
        <td>${fmt(total)}</td>
        <td><span class="badge badge-${p.invoice_status || 'none'}">${p.invoice_status || 'PENDING'}</span></td>
        <td>
          <a href="#new-project" onclick="openProject(${p.id})" class="btn btn-sm btn-outline">OPEN</a>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:24px;font-family:Orbitron,sans-serif;font-size:.65rem;letter-spacing:2px;">NO PROJECTS YET</td></tr>';

    // Printer health bars
    const printerBars = (d.printers || []).map(p => {
      const pct = Math.max(0, Math.min(100, (p.health_hours_remaining / p.total_lifetime_hrs) * 100));
      const col = pct > 30 ? 'var(--neon-green)' : pct > 10 ? 'var(--neon-yellow)' : 'var(--neon-magenta)';
      return `<div style="margin-bottom:14px">
        <div class="health-label"><span>${escHtml(p.name)}</span><span>${p.health_hours_remaining.toFixed(0)} / ${p.total_lifetime_hrs.toFixed(0)} hrs</span></div>
        <div class="health-gauge"><div class="health-bar" style="width:${pct.toFixed(1)}%;background:${col}"></div></div>
      </div>`;
    }).join('') || '<div class="text-dim" style="font-size:.75rem">No printers configured. <a href="#printer" style="color:var(--neon-cyan)">Add one →</a></div>';

    document.getElementById('dash-content').innerHTML = `
      ${warnings}
      <div class="stats-grid mb-6">
        <div class="stat-card card"><div class="stat-label">Total Projects</div><div class="stat-value">${d.total_projects}</div></div>
        <div class="stat-card card"><div class="stat-label">Total Revenue</div><div class="stat-value">${fmt(d.total_revenue)}</div></div>
        <div class="stat-card card"><div class="stat-label">Print Hours</div><div class="stat-value">${Number(d.total_hours || 0).toFixed(1)}h</div></div>
        <div class="stat-card card"><div class="stat-label">Printers Online</div><div class="stat-value">${(d.printers || []).length}</div></div>
      </div>

      <div class="grid-2 gap-3" style="gap:20px">
        <div class="card">
          <div class="form-section-title">Recent Projects</div>
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Project</th><th>Client</th><th>Date</th><th>Total</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div class="mt-4"><a href="#history" class="btn btn-ghost btn-sm">VIEW ALL HISTORY →</a></div>
        </div>

        <div class="card card-mag">
          <div class="form-section-title">Printer Health</div>
          ${printerBars}
          <div class="mt-4"><a href="#printer" class="btn btn-ghost btn-sm">MANAGE PRINTERS →</a></div>
        </div>
      </div>`;
  } catch (e) {
    document.getElementById('dash-content').innerHTML = `<div class="alert alert-danger">Failed to load dashboard: ${e.message}</div>`;
  }
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.openProject = async (id) => {
  window._editProjectId = id;
  location.hash = 'new-project';
};
