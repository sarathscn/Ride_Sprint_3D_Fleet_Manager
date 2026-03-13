/* ── analytics.js — Monthwise Pie Chart Analysis ───── */

let _analyticsData = {};
let _charts = {};

async function renderAnalysis() {
  setPage(`<div class="animate-in">
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div class="page-title">BUSINESS ANALYSIS</div>
        <div class="page-sub">Interactive monthwise performance breakdown</div>
      </div>
      <div class="form-group" style="width:200px">
        <label style="font-size:0.7rem">SELECT MONTH</label>
        <select id="analysis-month-select" onchange="updateAnalyticsView(this.value)">
          <option value="">Loading...</option>
        </select>
      </div>
    </div>

    <div id="analytics-content">
        <div class="grid-2" style="gap:20px; margin-bottom:20px">
          <div class="card">
            <div class="form-section-title">REVENUE & PROFIT DISTRIBUTION</div>
            <div style="height:250px"><canvas id="chart-revenue-dist"></canvas></div>
            <p class="help-text mt-2" id="text-revenue-total"></p>
          </div>
          <div class="card">
            <div class="form-section-title">MATERIAL CONSUMPTION (GRAMS)</div>
            <div style="height:250px"><canvas id="chart-material-dist"></canvas></div>
            <p class="help-text mt-2" id="text-material-total"></p>
          </div>
        </div>

        <div class="grid-2" style="gap:20px">
          <div class="card">
            <div class="form-section-title">PRINTER TIME ALLOCATION (HRS)</div>
            <div style="height:250px"><canvas id="chart-printer-dist"></canvas></div>
            <p class="help-text mt-2" id="text-printer-total"></p>
          </div>
          <div class="card card-mag">
            <div class="form-section-title">DATE-WISE SUMMARY EXPORT</div>
            <div class="alert alert-info" style="font-size:0.65rem">Export all projects and costs to CSV file for the selected period.</div>
            <div class="form-grid mt-4">
              <div class="form-group">
                <label>FROM DATE</label>
                <input type="date" id="export-from">
              </div>
              <div class="form-group">
                <label>TO DATE</label>
                <input type="date" id="export-to">
              </div>
            </div>
            <button class="btn btn-primary w-full mt-4" onclick="handleExport()">⬇ DOWNLOAD CSV SUMMARY</button>
            <div class="mt-4" id="text-status-total"></div>
            <div style="height:150px"><canvas id="chart-status-dist"></canvas></div>
          </div>
        </div>
    </div>
  </div>`);

  if (!window.Chart) {
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }

  try {
    _analyticsData = await api.get('/stats');
    const months = Object.keys(_analyticsData).sort().reverse();
    const select = document.getElementById('analysis-month-select');
    
    if (months.length === 0) {
      select.innerHTML = '<option value="">No Data</option>';
      document.getElementById('analytics-content').innerHTML = `
        <div class="card animate-in" style="text-align:center; padding:100px;">
            <div style="font-size:3rem; margin-bottom:20px">📊</div>
            <h2 class="glitch-text">NO DATA AVAILABLE</h2>
            <p class="text-dim">Add projects to start seeing your printing analytics.</p>
        </div>`;
      return;
    }

    select.innerHTML = months.map(m => `<option value="${m}">${m}</option>`).join('');
    
    // Set default dates for export
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    document.getElementById('export-from').value = firstDay;
    document.getElementById('export-to').value = lastDay;

    updateAnalyticsView(months[0]);
  } catch (e) {
    toast('Analytics Error: ' + e.message, 'error');
  }
}

function updateAnalyticsView(month) {
  const mData = _analyticsData[month];
  if (!mData) return;

  // Clear existing charts
  Object.values(_charts).forEach(c => c.destroy());
  _charts = {};

  const textColor = '#e8eaed';
  const colors = ['#00f0ff', '#ff003c', '#f8ef00', '#00ff9d', '#9d00ff', '#ff8c00', '#0070ff', '#00ff00'];

  // 1. Revenue/Profit Distribution
  const revLabels = ['Net Profit', 'Material', 'Elec', 'Labor', 'Hardware', 'Pkg', 'Ship', 'Fees'];
  const b = mData.costsBreakdown;
  const revData = [mData.profit, b.material, b.electricity, b.labor, b.hardware, b.packaging, b.shipping, b.platform];
  
  _charts.rev = new Chart(document.getElementById('chart-revenue-dist'), {
    type: 'pie',
    data: {
      labels: revLabels,
      datasets: [{ data: revData, backgroundColor: colors, borderColor: 'rgba(0,0,0,0.2)' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: textColor, font: { family: 'Orbitron', size: 9 } } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${fmt(ctx.raw)}` } }
      }
    }
  });
  const totalExpense = mData.revenue - mData.profit;
  document.getElementById('text-revenue-total').innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:0.8rem">
      <span>Total Revenue: <strong style="color:var(--neon-cyan)">${fmt(mData.revenue)}</strong></span>
      <span>Total Expense: <strong style="color:var(--neon-magenta)">${fmt(totalExpense)}</strong></span>
      <span>Net Profit: <strong style="color:var(--neon-green)">${fmt(mData.profit)}</strong></span>
    </div>
  `;

  // 2. Material Usage
  const matLabels = Object.keys(mData.materials);
  const matValues = Object.values(mData.materials);
  _charts.mat = new Chart(document.getElementById('chart-material-dist'), {
    type: 'pie',
    data: {
      labels: matLabels,
      datasets: [{ data: matValues, backgroundColor: colors, borderColor: 'rgba(0,0,0,0.2)' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: textColor, font: { family: 'Orbitron', size: 10 } } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw.toFixed(1)}g` } }
      }
    }
  });
  document.getElementById('text-material-total').textContent = `Total Material Used: ${mData.materialWeight.toFixed(1)}g`;

  // 3. Printer Time
  const prLabels = Object.keys(mData.printers);
  const prValues = Object.values(mData.printers);
  _charts.pr = new Chart(document.getElementById('chart-printer-dist'), {
    type: 'pie',
    data: {
      labels: prLabels,
      datasets: [{ data: prValues, backgroundColor: colors, borderColor: 'rgba(0,0,0,0.2)' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: textColor, font: { family: 'Orbitron', size: 10 } } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw.toFixed(1)}h` } }
      }
    }
  });
  document.getElementById('text-printer-total').textContent = `Total Print Hours: ${mData.hours.toFixed(1)}h`;

  // 4. Status
  _charts.stArr = new Chart(document.getElementById('chart-status-dist'), {
    type: 'pie',
    data: {
      labels: ['Invoiced', 'Pending'],
      datasets: [{ data: [mData.status.invoiced, mData.status.pending], backgroundColor: ['#00ff9d', '#ff003c'], borderColor: 'rgba(0,0,0,0.2)' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: textColor, font: { family: 'Orbitron', size: 10 } } }
      }
    }
  });
  document.getElementById('text-status-total').textContent = `Total Projects: ${mData.count}`;
}

function handleExport() {
  const from = document.getElementById('export-from').value;
  const to = document.getElementById('export-to').value;
  if (!from || !to) return toast('Please select date range', 'warn');
  window.location.href = `/api/export?from=${from}&to=${to}`;
}
