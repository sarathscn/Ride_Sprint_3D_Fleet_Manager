/**
 * db.js — SQLite via sql.js (pure JS, no native build tools needed)
 * The database is loaded from / saved to printmanager.db on disk.
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'printmanager.db');

// sql.js exports initSqlJs which returns a Promise
let DB = null;

async function getDb() {
  if (DB) return DB;
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    DB = new SQL.Database(fileBuffer);
  } else {
    DB = new SQL.Database();
  }
  DB.run(`PRAGMA foreign_keys = ON;`);
  createSchema(DB);
  return DB;
}

function save(db) {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS printer_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      total_lifetime_hrs REAL NOT NULL DEFAULT 5000,
      health_hours_remaining REAL NOT NULL DEFAULT 5000,
      warning_threshold REAL NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      client TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      material_type TEXT NOT NULL DEFAULT 'PLA',
      currency TEXT NOT NULL DEFAULT 'USD',
      printer_id INTEGER REFERENCES printer_profiles(id) ON DELETE SET NULL,
      inputs_json TEXT NOT NULL DEFAULT '{}',
      costs_json TEXT NOT NULL DEFAULT '{}',
      invoice_status TEXT NOT NULL DEFAULT 'none',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL UNIQUE,
      issued_at TEXT NOT NULL DEFAULT (datetime('now')),
      discount_type TEXT NOT NULL DEFAULT 'flat',
      discount_value REAL NOT NULL DEFAULT 0,
      final_total REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  // Migration: Add hidden_fields to invoices if missing
  try {
    db.run(`ALTER TABLE invoices ADD COLUMN hidden_fields TEXT DEFAULT '[]'`);
    console.log('[DB] Migrated invoices: added hidden_fields');
    save(db);
  } catch(e) { /* already exists */ }
  
  // Migration: Add currency to projects if missing
  try {
    db.run(`ALTER TABLE projects ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'`);
    console.log('[DB] Migrated projects: added currency');
    save(db);
  } catch(e) { /* already exists */ }

  // Migration: Add multi_projects_json to invoices if missing
  try {
    db.run(`ALTER TABLE invoices ADD COLUMN multi_projects_json TEXT DEFAULT '[]'`);
    console.log('[DB] Migrated invoices: added multi_projects_json');
    save(db);
  } catch(e) { /* already exists */ }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(db, sql, params = []) {
  const rows = queryAll(db, sql, params);
  return rows[0] || null;
}

function run(db, sql, params = []) {
  db.run(sql, params);
  const row = queryOne(db, `SELECT last_insert_rowid() as id`);
  save(db);
  return { lastInsertRowid: row ? row.id : null };
}

// ─── Project queries ──────────────────────────────────────────────────────────

function getAllProjects(db, { q, from, to } = {}) {
  if (q) {
    return queryAll(db, `SELECT * FROM projects WHERE name LIKE ? OR client LIKE ? ORDER BY created_at DESC`, [`%${q}%`, `%${q}%`]);
  }
  if (from && to) {
    return queryAll(db, `SELECT * FROM projects WHERE date(created_at) BETWEEN date(?) AND date(?) ORDER BY created_at DESC`, [from, to]);
  }
  return queryAll(db, `SELECT * FROM projects ORDER BY created_at DESC`);
}

function insertProject(db, { name, client, description, material_type, currency, printer_id, inputs_json, costs_json }) {
  return run(db, `INSERT INTO projects (name,client,description,material_type,currency,printer_id,inputs_json,costs_json) VALUES (?,?,?,?,?,?,?,?)`,
    [name, client || '', description || '', material_type || 'PLA', currency || 'USD', printer_id || null, inputs_json, costs_json]);
}

function updateProject(db, { id, name, client, description, material_type, currency, inputs_json, costs_json }) {
  return run(db, `UPDATE projects SET name=?,client=?,description=?,material_type=?,currency=?,inputs_json=?,costs_json=?,updated_at=datetime('now') WHERE id=?`,
    [name, client || '', description || '', material_type || 'PLA', currency || 'USD', inputs_json, costs_json, id]);
}

function getProject(db, id) {
  return queryOne(db, `SELECT * FROM projects WHERE id=?`, [id]);
}

function deleteProject(db, id) {
  return run(db, `DELETE FROM projects WHERE id=?`, [id]);
}

function setInvoiceStatus(db, id, status) {
  return run(db, `UPDATE projects SET invoice_status=? WHERE id=?`, [status, id]);
}

function getDashboard(db) {
  return queryOne(db, `
    SELECT
      COUNT(*) as total_projects,
      SUM(CAST(json_extract(costs_json,'$.total') AS REAL)) as total_revenue,
      SUM(CAST(json_extract(inputs_json,'$.printHours') AS REAL)) as total_hours
    FROM projects
  `);
}

function getRecentProjects(db) {
  return queryAll(db, `SELECT id,name,client,created_at,costs_json,invoice_status FROM projects ORDER BY created_at DESC LIMIT 5`);
}

// ─── Printer queries ──────────────────────────────────────────────────────────

function getAllPrinters(db) {
  return queryAll(db, `SELECT * FROM printer_profiles ORDER BY id DESC`);
}

function getPrinter(db, id) {
  return queryOne(db, `SELECT * FROM printer_profiles WHERE id=?`, [id]);
}

function insertPrinter(db, { name, total_lifetime_hrs, health_hours_remaining, warning_threshold }) {
  return run(db, `INSERT INTO printer_profiles (name,total_lifetime_hrs,health_hours_remaining,warning_threshold) VALUES (?,?,?,?)`,
    [name, total_lifetime_hrs, health_hours_remaining, warning_threshold]);
}

function updatePrinter(db, { id, name, total_lifetime_hrs, health_hours_remaining, warning_threshold }) {
  return run(db, `UPDATE printer_profiles SET name=?,total_lifetime_hrs=?,health_hours_remaining=?,warning_threshold=? WHERE id=?`,
    [name, total_lifetime_hrs, health_hours_remaining, warning_threshold, id]);
}

function deductPrinterHours(db, id, hours) {
  return run(db, `UPDATE printer_profiles SET health_hours_remaining=MAX(0,health_hours_remaining-?) WHERE id=?`, [hours, id]);
}

function deletePrinter(db, id) {
  return run(db, `DELETE FROM printer_profiles WHERE id=?`, [id]);
}

// ─── Invoice queries ──────────────────────────────────────────────────────────

function insertInvoice(db, { project_id, multi_projects, invoice_number, discount_type, discount_value, final_total, hidden_fields }) {
  return run(db, `INSERT INTO invoices (project_id, multi_projects_json, invoice_number, discount_type, discount_value, final_total, hidden_fields) VALUES (?,?,?,?,?,?,?)`,
    [project_id, JSON.stringify(multi_projects || []), invoice_number, discount_type, discount_value, final_total, JSON.stringify(hidden_fields || [])]);
}

function getInvoice(db, id) {
  return queryOne(db, `SELECT * FROM invoices WHERE id=?`, [id]);
}

function getAllInvoices(db) {
  return queryAll(db, `SELECT i.*, p.name as project_name, p.client, p.currency FROM invoices i JOIN projects p ON i.project_id=p.id ORDER BY i.issued_at DESC`);
}

// ─── Settings queries ─────────────────────────────────────────────────────────

function getSettings(db) {
  const rows = queryAll(db, `SELECT * FROM settings`);
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  return settings;
}

function updateSetting(db, key, value) {
  return run(db, `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [key, value]);
}

module.exports = {
  getDb, save,
  getAllProjects, insertProject, updateProject, getProject, deleteProject, setInvoiceStatus, getDashboard, getRecentProjects,
  getAllPrinters, getPrinter, insertPrinter, updatePrinter, deductPrinterHours, deletePrinter,
  insertInvoice, getInvoice, getAllInvoices,
  getSettings, updateSetting
};
