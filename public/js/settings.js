/* ── settings.js — Company profile & branding ──────── */

async function renderSettings() {
  const s = await api.get('/settings');
  
  setPage(`
    <div class="page-header animate-in">
      <div>
        <h1 class="page-title">SYSTEM CONFIG — BRANDING</h1>
        <p class="page-sub">Configure your professional identity & letterhead</p>
      </div>
    </div>
    
    <div class="grid-2 animate-in">
      <div class="card">
        <div class="form-section-title">COMPANY PROFILE</div>
        <div class="form-group mb-4">
          <label>Business Name</label>
          <input type="text" id="set-name" value="${s.companyName || 'RIDE SPRINT 3D'}" placeholder="e.g. Ride Sprint 3D">
        </div>
        <div class="form-group mb-4">
          <label>Professional Slogan</label>
          <input type="text" id="set-slogan" value="${s.companySlogan || 'Professional Fleet Fabrication & Cost Optimization'}" placeholder="e.g. Precision Engineering & Prototyping">
        </div>
        <div class="form-grid mb-4">
          <div class="form-group">
            <label>Business Email</label>
            <input type="email" id="set-email" value="${s.companyEmail || 'contact@ridesprint3d.com'}" placeholder="contact@example.com">
          </div>
          <div class="form-group">
            <label>Contact Phone/Web</label>
            <input type="text" id="set-contact" value="${s.companyContact || ''}" placeholder="+1 234 567 890">
          </div>
        </div>

        <div class="form-group mb-4">
          <label>Global Site Currency</label>
          <select id="set-currency">
             ${['USD','BHD','EUR','GBP','INR','AED','SAR','KWD'].map(c => 
               `<option value="${c}" ${s.defaultCurrency === c ? 'selected' : ''}>${c} (${CURRENCY_SYMBOLS[c] || c})</option>`
             ).join('')}
          </select>
          <p class="help-text mt-1">This will update all projects, history, and invoices across the entire site.</p>
        </div>
        
        <div class="form-section-title mt-6">BRAND ASSETS</div>
        <div class="form-group mb-4">
          <label>Company Logo</label>
          <div style="display:flex; gap:12px; align-items:center; background:rgba(0,0,0,0.2); padding:10px; border:1px solid var(--border);">
            <div id="logo-preview-box" class="logo-preview-small" style="border-color:var(--border-strong);">
              ${s.companyLogo ? `<img src="${s.companyLogo}" />` : '<span style="font-size:0.5rem">NONE</span>'}
            </div>
            <div style="flex:1; display:flex; gap:8px;">
              <input type="file" id="set-logo-file" accept="image/*" style="display:none" onchange="handleLogoUpload(this)">
              <button class="btn btn-outline btn-sm" style="flex:1" onclick="document.getElementById('set-logo-file').click()">ADD LOGO</button>
              <button class="btn btn-danger btn-sm" style="padding:7px 10px" onclick="removeLogo()">REMOVE</button>
            </div>
          </div>
          <input type="hidden" id="set-logo-data" value="${s.companyLogo || ''}">
          <p class="help-text mt-1">Recommended: Square PNG with transparent background.</p>
        </div>

        <div class="btn-group mt-6">
          <button class="btn btn-primary" onclick="saveSettings()">SAVE CONFIGURATION</button>
        </div>
      </div>

      <div class="card card-mag">
        <div class="form-section-title">PREVIEW: SYSTEM TITLE</div>
        <div class="preview-site-title">
           <span class="glitch-text">${s.companyName || 'RIDE SPRINT 3D'}</span>
        </div>
        
        <div class="form-section-title mt-6">PREVIEW: LETTERHEAD</div>
        <div class="preview-letterhead">
           <div style="display:flex; gap:15px; align-items:center">
             <div class="logo-preview-small" id="preview-lh-logo">
               ${s.companyLogo ? `<img src="${s.companyLogo}" />` : 'LOGO'}
             </div>
             <div>
               <h3 id="preview-lh-name">${s.companyName || 'RIDE SPRINT 3D'}</h3>
               <p id="preview-lh-slogan" style="font-size:0.7rem; color:var(--text-dim)">${s.companySlogan || 'Professional Fleet Fabrication'}</p>
               <p id="preview-lh-meta" style="font-size:0.6rem; color:var(--text-dim)">${s.companyEmail || 'contact@ridesprint3d.com'}</p>
             </div>
           </div>
        </div>
        <p class="help-text mt-4">These settings will be applied to all future PDF invoices and the main application header.</p>
      </div>
    </div>
  `);
}

async function handleLogoUpload(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const data = e.target.result;
      document.getElementById('set-logo-data').value = data;
      document.getElementById('logo-preview-box').innerHTML = `<img src="${data}" />`;
      document.getElementById('preview-lh-logo').innerHTML = `<img src="${data}" />`;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function removeLogo() {
  document.getElementById('set-logo-data').value = '';
  document.getElementById('logo-preview-box').innerHTML = '<span style="font-size:0.5rem">NONE</span>';
  document.getElementById('preview-lh-logo').innerHTML = '<span style="font-size:0.5rem">LOGO</span>';
  document.getElementById('set-logo-file').value = ''; // Clear file input
}

async function saveSettings() {
  const body = {
    companyName: document.getElementById('set-name').value,
    companySlogan: document.getElementById('set-slogan').value,
    companyEmail: document.getElementById('set-email').value,
    companyContact: document.getElementById('set-contact').value,
    companyLogo: document.getElementById('set-logo-data').value,
    defaultCurrency: document.getElementById('set-currency').value,
  };
  
  try {
    await api.post('/settings', body);
    window._settings = body; // Update global cache
    toast('Settings saved successfully!');
    // Update UI title immediately
    document.querySelectorAll('.nav-logo-text').forEach(el => el.textContent = body.companyName);
    document.title = body.companyName + ' — Print Manager';
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
}
