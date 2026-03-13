const express = require('express');
const cors = require('cors');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/stats', async (req, res) => {
  try {
    const D = await db.getDb();
    const projects = db.getAllProjects(D);
    const printers = db.getAllPrinters(D);
    const printerMap = {};
    printers.forEach(pr => printerMap[pr.id] = pr.name);
    
    const monthlyData = {};
    projects.forEach(p => {
      const costs = JSON.parse(p.costs_json || '{}');
      const inputs = JSON.parse(p.inputs_json || '{}');
      const date = p.created_at || new Date().toISOString();
      const month = date.substring(0, 7);
      
      if (!monthlyData[month]) {
        monthlyData[month] = { 
          revenue: 0, profit: 0, materialWeight: 0, hours: 0, count: 0,
          costsBreakdown: { material: 0, electricity: 0, labor: 0, hardware: 0, packaging: 0, shipping: 0, platform: 0 },
          materials: {},
          printers: {},
          status: { invoiced: 0, pending: 0 }
        };
      }
      
      const m = monthlyData[month];
      m.revenue += costs.total || 0;
      m.profit += costs.profit || 0;
      m.materialWeight += (inputs.printWeight || 0) + (inputs.supportWeight || 0);
      m.hours += inputs.printHours || 0;
      m.count += 1;

      // Breakdown for Pie
      m.costsBreakdown.material += costs.material || 0;
      m.costsBreakdown.electricity += costs.electricity || 0;
      m.costsBreakdown.labor += costs.labor || 0;
      m.costsBreakdown.hardware += costs.hardware || 0;
      m.costsBreakdown.packaging += costs.packaging || 0;
      m.costsBreakdown.shipping += costs.shipping || 0;
      m.costsBreakdown.platform += costs.platformFee || 0;

      const mat = p.material_type || 'Unknown';
      m.materials[mat] = (m.materials[mat] || 0) + ((inputs.printWeight || 0) + (inputs.supportWeight || 0));

      const prName = printerMap[p.printer_id] || 'Unknown Printer';
      m.printers[prName] = (m.printers[prName] || 0) + (inputs.printHours || 0);

      if (p.invoice_status === 'invoiced') m.status.invoiced++;
      else m.status.pending++;
    });
    res.json(monthlyData);
  } catch (e) { err(res, e.message, 500); }
});

app.get('/api/settings', async (req, res) => {
  try {
    const D = await db.getDb();
    res.json(db.getSettings(D));
  } catch (e) { err(res, e.message, 500); }
});

app.post('/api/settings', async (req, res) => {
  try {
    const D = await db.getDb();
    for (const [key, val] of Object.entries(req.body)) {
      db.updateSetting(D, key, val);
    }
    res.json({ success: true });
  } catch (e) { err(res, e.message, 500); }
});

const makeInvoiceNumber = () => 'INV-' + Date.now().toString().slice(-8);

function err(res, msg, code = 400) {
  return res.status(code).json({ error: msg });
}

const CURRENCY_MAP = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', BHD: 'BD', AED: 'د.إ', SAR: 'ر.س', KWD: 'د.ك'
};

function parseProject(p) {
  if (!p) return null;
  return { ...p, inputs: JSON.parse(p.inputs_json || '{}'), costs: JSON.parse(p.costs_json || '{}') };
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
  try {
    const D = await db.getDb();
    const stats = db.getDashboard(D) || {};
    const recent = db.getRecentProjects(D).map(p => ({ ...p, costs: JSON.parse(p.costs_json || '{}') }));
    const printers = db.getAllPrinters(D);
    res.json({ total_projects: stats.total_projects || 0, total_revenue: stats.total_revenue || 0, total_hours: stats.total_hours || 0, printers, recent_projects: recent });
  } catch (e) { err(res, e.message, 500); }
});

// ─── PROJECTS ────────────────────────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
  try {
    const D = await db.getDb();
    const rows = db.getAllProjects(D, req.query).map(parseProject);
    res.json(rows);
  } catch (e) { err(res, e.message, 500); }
});

app.post('/api/projects', async (req, res) => {
  try {
    const D = await db.getDb();
    const { name, client, description, material_type, currency, printer_id, inputs, costs } = req.body;
    if (!name) return err(res, 'Project name is required');
    
    console.log(`[API] Creating project: ${name}, Currency: ${currency}, Printer: ${printer_id}, Hours: ${inputs?.printHours}`);
    
    const result = db.insertProject(D, { 
      name, client, description, material_type, 
      currency: currency || 'USD',
      printer_id, 
      inputs_json: JSON.stringify(inputs || {}), 
      costs_json: JSON.stringify(costs || {}) 
    });
    
    if (printer_id && inputs?.printHours) {
        console.log(`[API] Deducting ${inputs.printHours}h from printer ${printer_id}`);
        db.deductPrinterHours(D, printer_id, inputs.printHours);
    }
    
    res.status(201).json(parseProject(db.getProject(D, result.lastInsertRowid)));
  } catch (e) { 
    console.error('[API] Error in POST /projects:', e);
    err(res, e.message, 500); 
  }
});

app.get('/api/export', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return err(res, 'from and to dates required (YYYY-MM-DD)');
    
    const D = await db.getDb();
    const projects = db.getAllProjects(D, { from, to }).map(parseProject);
    
    let csv = 'ID,Name,Client,Date,Material Type,Currency,Material Cost,Electricity,Hardware,Labor,Subtotal,Profit,Total,Status\n';
    projects.forEach(p => {
      const c = p.costs;
      csv += [
        p.id,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.client.replace(/"/g, '""')}"`,
        p.created_at.split(' ')[0],
        p.material_type,
        p.currency,
        c.material?.toFixed(3) || 0,
        c.electricity?.toFixed(3) || 0,
        c.hardware?.toFixed(3) || 0,
        c.labor?.toFixed(3) || 0,
        c.subtotal?.toFixed(3) || 0,
        c.profit?.toFixed(3) || 0,
        c.total?.toFixed(3) || 0,
        p.invoice_status
      ].join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="print_summary_${from}_to_${to}.csv"`);
    res.send(csv);
  } catch (e) { err(res, e.message, 500); }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const D = await db.getDb();
    const p = parseProject(db.getProject(D, req.params.id));
    if (!p) return err(res, 'Not found', 404);
    res.json(p);
  } catch (e) { err(res, e.message, 500); }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const D = await db.getDb();
    const { name, client, description, material_type, currency, inputs, costs } = req.body;
    db.updateProject(D, { 
      id: req.params.id, 
      name, client, description, material_type, 
      currency: currency || 'USD',
      inputs_json: JSON.stringify(inputs || {}), 
      costs_json: JSON.stringify(costs || {}) 
    });
    res.json(parseProject(db.getProject(D, req.params.id)));
  } catch (e) { err(res, e.message, 500); }
});

app.post('/api/projects/:id/duplicate', async (req, res) => {
  try {
    const D = await db.getDb();
    const p = db.getProject(D, req.params.id);
    if (!p) return err(res, 'Project not found', 404);
    const result = db.insertProject(D, {
      name: p.name + ' (Copy)',
      client: p.client,
      description: p.description,
      material_type: p.material_type,
      currency: p.currency,
      printer_id: p.printer_id,
      inputs_json: p.inputs_json,
      costs_json: p.costs_json
    });
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) { err(res, e.message, 500); }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const D = await db.getDb();
    db.deleteProject(D, req.params.id);
    res.json({ success: true });
  } catch (e) { err(res, e.message, 500); }
});

// ─── PRINTERS ────────────────────────────────────────────────────────────────
app.get('/api/printers', async (req, res) => {
  try {
    const D = await db.getDb();
    res.json(db.getAllPrinters(D));
  } catch (e) { err(res, e.message, 500); }
});

app.post('/api/printers', async (req, res) => {
  try {
    const D = await db.getDb();
    const { name, total_lifetime_hrs, health_hours_remaining, warning_threshold } = req.body;
    if (!name) return err(res, 'Printer name required');
    const totalHrs = total_lifetime_hrs || 5000;
    const result = db.insertPrinter(D, { name, total_lifetime_hrs: totalHrs, health_hours_remaining: health_hours_remaining ?? totalHrs, warning_threshold: warning_threshold || 100 });
    res.status(201).json(db.getPrinter(D, result.lastInsertRowid));
  } catch (e) { err(res, e.message, 500); }
});

app.put('/api/printers/:id', async (req, res) => {
  try {
    const D = await db.getDb();
    const { name, total_lifetime_hrs, health_hours_remaining, warning_threshold } = req.body;
    db.updatePrinter(D, { id: req.params.id, name, total_lifetime_hrs: total_lifetime_hrs || 5000, health_hours_remaining: health_hours_remaining ?? total_lifetime_hrs, warning_threshold: warning_threshold || 100 });
    res.json(db.getPrinter(D, req.params.id));
  } catch (e) { err(res, e.message, 500); }
});

app.delete('/api/printers/:id', async (req, res) => {
  try {
    const D = await db.getDb();
    db.deletePrinter(D, req.params.id);
    res.json({ success: true });
  } catch (e) { err(res, e.message, 500); }
});

// ─── INVOICES ────────────────────────────────────────────────────────────────
app.get('/api/invoices', async (req, res) => {
  try {
    const D = await db.getDb();
    const rows = db.getAllInvoices(D);
    res.json(rows);
  } catch (e) { 
    console.error('[API] Invoices Error:', e);
    err(res, e.message, 500); 
  }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const { projects, discount_type, discount_value, hidden_fields } = req.body;
    if (!projects || !projects.length) return err(res, 'At least one project is required');

    const D = await db.getDb();
    const invoice_number = makeInvoiceNumber();
    
    // Calculate final total from all projects
    let subtotal = 0;
    for (const item of projects) {
      const p = db.getProject(D, item.id);
      if (!p) continue;
      const costs = JSON.parse(p.costs_json || '{}');
      subtotal += (costs.total || 0) * (item.qty || 1);
    }

    const discAmt = discount_type === 'percent' ? (subtotal * (discount_value || 0) / 100) : (discount_value || 0);
    const final_total = Math.max(0, subtotal - discAmt);

    const inv = db.insertInvoice(D, {
      project_id: projects[0].id, // Primary project for relation
      multi_projects: projects,
      invoice_number,
      discount_type: discount_type || 'flat',
      discount_value: discount_value || 0,
      final_total,
      hidden_fields: hidden_fields || []
    });

    db.setInvoiceStatus(D, projects[0].id, 'invoiced');
    res.json({ id: inv.lastInsertRowid, invoice_number, final_total });
  } catch (e) { 
    console.error('[API] POST Invoice Error:', e);
    err(res, e.message, 500); 
  }
});

// ─── INVOICE PDF ─────────────────────────────────────────────────────────────
app.get('/api/invoices/:id/pdf', async (req, res) => {
  try {
    const D = await db.getDb();
    const invoice = db.getInvoice(D, req.params.id);
    if (!invoice) return err(res, 'Not found', 404);
    
    const s = db.getSettings(D);
    const code = s.defaultCurrency || 'USD';
    
    const fmt = v => {
      const dec = (code === 'BHD' || code === 'KWD') ? 3 : 2;
      return `${(v || 0).toFixed(dec)} ${code}`;
    };

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    doc.pipe(res);

    // HEADER
    const logoBase64 = s.companyLogo;
    if (logoBase64 && logoBase64.startsWith('data:image')) {
       try {
         const base64Data = logoBase64.replace(/^data:image\/\w+;base64,/, "");
         doc.image(Buffer.from(base64Data, 'base64'), 40, 40, { width: 60 });
       } catch(e) { console.error('Logo render error', e); }
    } else {
      const LOGO = path.join(__dirname, 'ride_sprint_logo_v2_1773323382197.png');
      if (fs.existsSync(LOGO)) doc.image(LOGO, 40, 40, { width: 60 });
    }

    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(20).text(s.companyName || 'RIDE SPRINT 3D', 110, 45);
    doc.fontSize(10).font('Helvetica').fillColor('#666666')
       .text(s.companySlogan || 'Professional 3D Printing', 110, 68)
       .text(`Contact: ${s.companyEmail || 'contact@ridesprint3d.com'} ${s.companyContact ? '| ' + s.companyContact : ''}`, 110, 82);
    doc.moveTo(40, 110).lineTo(555, 110).strokeColor('#eeeeee').lineWidth(2).stroke();

    // META
    doc.fillColor('#333333').font('Helvetica-Bold').fontSize(22).text('INVOICE', 40, 130);
    const invDate = new Date(invoice.issued_at);
    const day = String(invDate.getDate()).padStart(2, '0');
    const month = String(invDate.getMonth() + 1).padStart(2, '0');
    doc.fontSize(10).font('Helvetica').fillColor('#777777')
       .text(`INV NO: ${invoice.invoice_number}`, 430, 135, { align: 'right' })
       .text(`DATE: ${day}/${month}/${invDate.getFullYear()}`, 430, 150, { align: 'right' });

    const primaryProject = db.getProject(D, invoice.project_id);
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(11).text('BILL TO:', 40, 175);
    doc.font('Helvetica').fontSize(10).text(primaryProject ? (primaryProject.client || 'Valued Customer') : 'Valued Customer', 40, 190);
    
    // TABLE
    let py = 250;
    doc.rect(40, py, 515, 20).fill('#333333');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
       .text('DESCRIPTION', 50, py+6)
       .text('MATERIAL', 220, py+6)
       .text('QTY', 340, py+6, { align: 'center', width: 40 })
       .text('UNIT PRICE', 390, py+6, { align: 'right', width: 70 })
       .text('TOTAL', 480, py+6, { align: 'right', width: 65 });
    py += 25;

    const hidden = JSON.parse(invoice.hidden_fields || '[]');
    const projectsToInvoice = JSON.parse(invoice.multi_projects_json || '[]');
    let runningSubtotal = 0;

    projectsToInvoice.forEach(item => {
      const p = db.getProject(D, item.id);
      if (!p) return;
      const costs = JSON.parse(p.costs_json || '{}');
      const qty = item.qty || 1;
      const unitPrice = costs.total || 0;
      const total = unitPrice * qty;
      runningSubtotal += total;

      // Check for page break BEFORE drawing the item
      if (py > 700) { doc.addPage(); py = 50; }

      const startY = py;
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9);
      doc.text(`${p.name.toUpperCase()}`, 50, py, { width: 160 });
      
      doc.font('Helvetica').fontSize(9)
         .text(p.material_type || 'PLA', 220, py)
         .text(qty.toString(), 340, py, { align: 'center', width: 40 })
         .text(fmt(unitPrice), 390, py, { align: 'right', width: 70 })
         .text(fmt(total), 480, py, { align: 'right', width: 65 });
      
      // Calculate how much space the description and breakdown take
      let metaHeight = 15; // default spacing if no desc or breakdown
      
      // Project Description
      if (p.description) {
        py += 15;
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666');
        const descH = doc.heightOfString(p.description, { width: 160 });
        doc.text(p.description, 50, py, { width: 160 });
        py += descH + 2;
      } else {
        py += 15;
      }

      // Cost Breakdown for this project
      const breakdown = [
        { label: 'Material Detail', val: costs.material },
        { label: 'Electricity', val: costs.electricity },
        { label: 'Machine Depr.', val: costs.hardware },
        { label: 'Labor Factor', val: costs.labor },
        { label: 'Packaging', val: costs.packaging },
        { label: 'Shipping', val: costs.shipping },
        { label: 'Service Fee', val: costs.platformFee }
      ].filter(b => !hidden.includes(b.label));

      if (breakdown.length > 0) {
        py += 15;
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#666666').text('COST BREAKDOWN DETAILS', 50, py);
        py += 15;
        
        breakdown.forEach(b => {
          if (py > 750) { doc.addPage(); py = 50; }
          doc.fontSize(8).font('Helvetica').fillColor('#444444');
          doc.text(b.label, 60, py);
          doc.text(fmt(b.val * qty), 480, py, { align: 'right', width: 65 });
          py += 12;
        });
        py += 5;
      } else {
        py += 15;
      }

      // Draw separation line after all project content is finished
      doc.moveTo(40, py).lineTo(555, py).strokeColor('#eeeeee').lineWidth(0.5).stroke();
      py += 10; 
    });

    // TOTALS
    if (py > 650) { doc.addPage(); py = 50; }
    py += 20;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
       .text('SUBTOTAL', 350, py).text(fmt(runningSubtotal), 400, py, { align: 'right', width: 145 });
    py += 20;

    if (invoice.discount_value > 0) {
      const discAmt = invoice.discount_type === 'percent' ? (runningSubtotal * invoice.discount_value / 100) : invoice.discount_value;
      doc.fillColor('#cc0000').text('DISCOUNT', 350, py).text(`-${fmt(discAmt)}`, 400, py, { align: 'right', width: 145 });
      py += 20;
    }

    doc.rect(340, py, 215, 30).fill('#000000');
    doc.fillColor('#ffffff').fontSize(14).text('TOTAL DUE', 350, py+8).text(fmt(invoice.final_total), 400, py+8, { align: 'right', width: 145 });

    doc.fontSize(8).fillColor('#aaaaaa').text('THIS IS A SYSTEM GENERATED DOCUMENT — RIDE SPRINT 3D', 40, 780, { align: 'center', width: 515 });
    doc.end();
  } catch (e) { 
    console.error('PDF Error:', e);
    err(res, e.message, 500); 
  }
});

// ─── SPA fallback ────────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`\n  🖨  3D Print Manager  →  http://localhost:${PORT}\n`));
