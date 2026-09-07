import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const dbPath = resolve(process.env.DATABASE_PATH || './data/leadforge.db');
mkdirSync(dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);

function parameters(params) {
  if (Array.isArray(params)) return params;
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key.replace(/^[$:@]/, ''), value]));
}

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sector TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','completed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    company TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'manuale',
    source_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','qualified','contacted','won','lost')),
    score INTEGER NOT NULL DEFAULT 50 CHECK(score BETWEEN 0 AND 100),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS leads_unique_source ON leads(company, city, source_url);
  CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
  CREATE INDEX IF NOT EXISTS leads_campaign_idx ON leads(campaign_id);
`);

export function query(sql, params = {}) {
  const values = parameters(params);
  return Array.isArray(values) ? db.prepare(sql).all(...values) : db.prepare(sql).all(values);
}

export function one(sql, params = {}) {
  const values = parameters(params);
  return Array.isArray(values) ? db.prepare(sql).get(...values) : db.prepare(sql).get(values);
}

export function run(sql, params = {}) {
  const values = parameters(params);
  return Array.isArray(values) ? db.prepare(sql).run(...values) : db.prepare(sql).run(values);
}

export function calculateScore(lead) {
  let score = 25;
  if (lead.website) score += 20;
  if (lead.email) score += 25;
  if (lead.phone) score += 20;
  if (lead.address) score += 10;
  return Math.min(score, 100);
}

export function upsertLead(lead) {
  const clean = {
    campaign_id: lead.campaign_id ? Number(lead.campaign_id) : null,
    company: String(lead.company || '').trim(),
    category: String(lead.category || '').trim(),
    city: String(lead.city || '').trim(),
    address: String(lead.address || '').trim(),
    website: String(lead.website || '').trim(),
    email: String(lead.email || '').trim().toLowerCase(),
    phone: String(lead.phone || '').trim(),
    source: String(lead.source || 'manuale').trim(),
    source_url: String(lead.source_url || '').trim(),
    notes: String(lead.notes || '').trim()
  };
  if (!clean.company) throw new Error('Il nome azienda è obbligatorio');
  const score = calculateScore(clean);
  return run(`
    INSERT INTO leads (campaign_id, company, category, city, address, website, email, phone, source, source_url, score, notes)
    VALUES ($campaign_id, $company, $category, $city, $address, $website, $email, $phone, $source, $source_url, $score, $notes)
    ON CONFLICT(company, city, source_url) DO UPDATE SET
      campaign_id=COALESCE(excluded.campaign_id, leads.campaign_id), category=excluded.category,
      address=excluded.address, website=excluded.website, email=excluded.email, phone=excluded.phone,
      score=excluded.score, notes=CASE WHEN excluded.notes='' THEN leads.notes ELSE excluded.notes END,
      updated_at=datetime('now')
  `, { ...clean, $score: score, $campaign_id: clean.campaign_id, $company: clean.company,
    $category: clean.category, $city: clean.city, $address: clean.address, $website: clean.website,
    $email: clean.email, $phone: clean.phone, $source: clean.source, $source_url: clean.source_url,
    $notes: clean.notes });
}
