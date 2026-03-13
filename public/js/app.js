/* ── app.js — Router, API client, global utilities ─────────── */
const API = 'http://localhost:3003/api';

// ─── API client ───────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || res.statusText);
  }
  return res.json();
}

window.api = {
  get:    (p)       => apiFetch(p),
  post:   (p, body) => apiFetch(p, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (p, body) => apiFetch(p, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (p)       => apiFetch(p, { method: 'DELETE' }),
};

// ─── Toast ────────────────────────────────────────────────────
let toastTimer;
window.toast = (msg, type = 'ok') => {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (type !== 'ok' ? ` ${type}` : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3000);
};

// ─── Theme Management ─────────────────────────────────────────
window.toggleTheme = () => {
  // Theme toggle removed - standardizing on Dark Cyberpunk
};

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode');
});

// ─── Disable Context Menu ─────────────────────────────────────
document.addEventListener('contextmenu', e => e.preventDefault());

// ─── Modal ────────────────────────────────────────────────────
window.modal = {
  open({ title, body, footer = '' }) {
    document.getElementById('modal-header').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-footer').innerHTML = footer;
    document.getElementById('modal-overlay').style.display = 'flex';
  },
  close() {
    document.getElementById('modal-overlay').style.display = 'none';
  },
};

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) modal.close();
});

// ─── Currency mapping ─────────────────────────────────────────
const CURRENCY_SYMBOLS = {
  USD: '$',
  BHD: 'BD',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  SAR: 'ر.س',
  KWD: 'د.ك'
};

window.getSym = (code) => CURRENCY_SYMBOLS[code || (_settings && _settings.defaultCurrency)] || '$';
window.fmt = (v, code) => {
  const c = code || (_settings && _settings.defaultCurrency) || 'USD';
  const sym = getSym(c);
  // Decimal places: 3 for BHD/KWD, 2 for others
  const dec = (c === 'BHD' || c === 'KWD') ? 3 : 2;
  return `${Number(v || 0).toFixed(dec)} ${sym}`;
};

// ─── Router ───────────────────────────────────────────────────
const routes = {
  'dashboard':   () => renderDashboard(),
  'analysis':    () => renderAnalysis(),
  'new-project': () => renderNewProject(),
  'history':     () => renderHistory(),
  'invoices':    () => renderInvoices(),
  'printer':     () => renderPrinter(),
  'help':        () => renderHelp(),
  'about':       () => renderAbout(),
  'settings':    () => renderSettings(),
};

function navigate(page) {
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });
  const render = routes[page] || routes['dashboard'];
  render();
}

function currentHash() {
  return location.hash.replace('#', '') || 'dashboard';
}

window.addEventListener('hashchange', () => navigate(currentHash()));

// ─── Utility: debounce ────────────────────────────────────────
window.debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

// ─── Utility: format date ─────────────────────────────────────
window.fmtDate = d => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// ─── Render a page into #page-content ─────────────────────────
window.setPage = (html) => {
  const el = document.getElementById('page-content');
  el.innerHTML = html;
  el.querySelectorAll('.animate-in')[0] || el.classList.add('animate-in');
};

// ─── Init ─────────────────────────────────────────────────────
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    location.hash = link.dataset.page;
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  // Sync branding
  try {
    window._settings = await api.get('/settings');
    const s = _settings;
    if (s.companyName) {
      document.querySelectorAll('.nav-logo-text').forEach(el => el.textContent = s.companyName);
      document.title = s.companyName + ' — Print Manager';
    }
  } catch(e) {
    window._settings = { defaultCurrency: 'USD' };
  }
  
  // First-time visit Welcome Tour
  if (!localStorage.getItem('tour_completed')) {
    localStorage.setItem('tour_completed', 'true');
    setTimeout(() => showWelcomeTour(0), 1000); // Small delay for effect
  }
  
  navigate(currentHash());
  initMouseTrailer();
});

// ─── Welcome Tour Logic ───────────────────────────────────────
window.showWelcomeTour = (step) => {
  const steps = [
    {
      title: 'WELCOME TO RIDE SPRINT',
      body: `
        <div style="text-align:center; margin-bottom:15px"><span style="font-size:3rem">🚀</span></div>
        <p style="font-size:0.9rem; line-height:1.4">Welcome Pilot. This manager will help you achieve 99% cost accuracy. Follow these 3 steps to set up your farm correctly.</p>
        <div class="card card-green" style="margin-top:15px">
          <strong style="font-size:0.7rem; color:var(--neon-green)">STEP 1: IDENTITY</strong>
          <p style="font-size:0.8rem; margin-top:5px">Navigate to <a href="#settings">Settings</a> to upload your logo and set your global currency. This brands your invoices instantly.</p>
        </div>
      `,
      footer: `<button class="btn btn-primary w-full" onclick="showWelcomeTour(1)">NEXT: FLEET SETUP ➜</button>`
    },
    {
      title: 'FLEET MANAGEMENT',
      body: `
        <div style="text-align:center; margin-bottom:15px"><span style="font-size:3rem">🖨️</span></div>
        <p style="font-size:0.9rem; line-height:1.4">Track hardware wear-and-tear effectively to ensure consistent quality.</p>
        <div class="card card-yellow" style="margin-top:15px">
          <strong style="font-size:0.7rem; color:var(--neon-yellow)">STEP 2: HEALTH TRACKING</strong>
          <p style="font-size:0.8rem; margin-top:5px">Add your machines in <a href="#printer">Printer Health</a>. The system automatically deducts print hours when you save a project.</p>
        </div>
      `,
      footer: `
        <div style="display:flex; gap:10px; width:100%">
          <button class="btn btn-ghost" onclick="showWelcomeTour(0)">BACK</button>
          <button class="btn btn-primary" style="flex:1" onclick="showWelcomeTour(2)">NEXT: ESTIMATION ➜</button>
        </div>
      `
    },
    {
      title: 'ACCURATE ESTIMATION',
      body: `
        <div style="text-align:center; margin-bottom:15px"><span style="font-size:3rem">💰</span></div>
        <p style="font-size:0.9rem; line-height:1.4">Now you are ready to compute some serious data.</p>
        <div class="card card-mag" style="margin-top:15px">
          <strong style="font-size:0.7rem; color:var(--neon-magenta)">STEP 3: LIVE BREAKDOWN</strong>
          <p style="font-size:0.8rem; margin-top:5px">Use <a href="#new-project">New Project</a> to see real-time math on materials, power, and labor. Save to history to generate invoices.</p>
        </div>
      `,
      footer: `
        <div style="display:flex; gap:10px; width:100%">
          <button class="btn btn-ghost" onclick="showWelcomeTour(1)">BACK</button>
          <button class="btn btn-green" style="flex:1" onclick="modal.close(); toast('Tour Complete!');">GET STARTED</button>
        </div>
      `
    }
  ];

  const s = steps[step];
  modal.open({
    title: s.title,
    body: s.body,
    footer: s.footer
  });
};

// ─── Mouse Trailer Logic ──────────────────────────────────────
function initMouseTrailer() {
  const trailer = document.getElementById('mouse-trailer');
  const dot = document.getElementById('mouse-dot');
  if (!trailer || !dot) return;

  window.addEventListener('mousemove', e => {
    const x = e.clientX, y = e.clientY;
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
    
    // Smooth trailing for the larger circle
    trailer.animate({
      left: (x - 10) + 'px',
      top: (y - 10) + 'px'
    }, { duration: 600, fill: "forwards", easing: "ease-out" });
  });
}

// ─── Info Page Handlers ───────────────────────────────────────
function renderHelp() {
  setPage(`
    <div class="page-header animate-in">
      <div>
        <h1 class="page-title">SYSTEM TERMINAL — DOCUMENTATION</h1>
        <p class="page-sub">Comprehensive guide & FAQ for Ride Sprint 3D</p>
      </div>
    </div>
    <div class="grid-2 animate-in" style="gap:20px; align-items:start">
      <div style="display:flex; flex-direction:column; gap:20px">
        <div class="card card-green">
          <div class="form-section-title">1. FIRST STEPS: BRANDING</div>
          <div class="help-content">
            <p><strong>Branding your business</strong> is the critical first step for professional invoices.</p>
            <ul>
              <li><strong>Company Logo:</strong> Upload a square PNG in <a href="#settings">Settings</a>. It will appear on the top-left of all PDFs.</li>
              <li><strong>Business Details:</strong> Your Name, Slogan, and Contact Info populate the invoice letterhead automatically.</li>
              <li><strong>Global Currency:</strong> Setting this in <a href="#settings">Settings</a> updates every single project and calculation in the database instantly.</li>
            </ul>
          </div>
        </div>

        <div class="card card-yellow">
          <div class="form-section-title">2. FLEET SETUP: PRINTERS</div>
          <div class="help-content">
            <p>Keep your hardware healthy by tracking its operational life.</p>
            <ul>
              <li><strong>Asset Cost:</strong> The purchase price of the printer. This is used to calculate "Hardware Depreciation" per project.</li>
              <li><strong>Auto-Deduction:</strong> When you save a project, the print duration is automatically subtracted from the assigned printer's health.</li>
              <li><strong>Maintenance:</strong> Once health hits the "Warning Threshold," the system will alert you that service is overdue.</li>
            </ul>
          </div>
        </div>

        <div class="card">
          <div class="form-section-title">3. PROJECT ESTIMATION TIPS</div>
          <div class="help-content">
            <p><strong>Material:</strong> Remember to include both Net Weight (model) and Support Weight. The "Waste %" (Loss Ratio) covers purge lines and failed print segments.</p>
            <p><strong>Power:</strong> Entry-level FDM printers typically pull 120W-250W. Large heated chambers or Resin printers with heaters can pull 400W+.</p>
            <p><strong>Labor:</strong> Enter your Tech Rate ($/hr) for slicing, cleanup, and painting. Don't worry about passive print time—the system handles that as a separate machine cost.</p>
          </div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:20px">
        <div class="card card-mag">
          <div class="form-section-title">FREQUENTLY ASKED QUESTIONS (FAQ)</div>
          <div class="help-content">
            <div class="faq-item">
              <strong>Q: How do I generate an invoice?</strong>
              <p>Go to <a href="#history">Project History</a>, find your project, and click "INVOICE". You can then select multiple projects, apply discounts, and export a PDF.</p>
            </div>
            <div class="faq-item">
              <strong>Q: Can I hide the design/hardware costs from clients?</strong>
              <p>Yes. In the Invoice screen, you can check "Hide Fields" for specific rows like Labor or Hardware to keep your internal margins private while showing the total.</p>
            </div>
            <div class="faq-item">
              <strong>Q: Is my data shared with Ride Sprint?</strong>
              <p>No. Your data is stored in a private SQLite database (\`printmanager.db\`) on your local hard drive. 100% privacy.</p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="form-section-title">ADVANCED CALCULATIONS</div>
          <div class="help-content">
            <p><strong>Depreciation Formula:</strong> <code>(Asset Cost / Lifetime Hours) * Print Time</code></p>
            <p><strong>Electricity Formula:</strong> <code>(Watts / 1000) * Print Time * Utility Rate</code></p>
            <p><strong>Market Risk:</strong> The Platforms Fee is calculated AFTER Failure Risk is added, ensuring you don't lose money on marketplace cuts.</p>
          </div>
        </div>
      </div>
    </div>
  `);
}

function renderAbout() {
  setPage(`
    <div class="page-header animate-in">
      <div>
        <h1 class="page-title">PROJECT ORIGIN — ABOUT</h1>
        <p class="page-sub">Software Identity & Developer Info</p>
      </div>
    </div>
    <div class="info-section animate-in">
      <div class="card card-mag">
        <div class="form-section-title">SYSTEM INFO</div>
        <p>Ride Sprint 3D Print Manager — Professional-grade fleet management and cost optimization tool.</p>
        <div style="font-size:0.8rem; margin:10px 0; color:var(--neon-cyan)">
           VERSION: 2.1-STABLE<br>
           LICENSE: PRO-ENTERPRISE<br>
           BUILD: ${new Date().getFullYear()}
        </div>
        <div class="about-links">
          <a href="https://github.com/sarathscn" target="_blank">
            <span style="font-size:1.2rem">🔗</span> DEVELOPER: sarathscn
          </a>
        </div>
      </div>
    </div>
  `);
}
