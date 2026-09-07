import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, one, run, upsertLead } from './db.js';
import { discoverOpenStreetMap, enrichWebsite, parseCsv } from './discovery.js';

const port = Number(process.env.PORT || 8080);
const publicDir = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' };

const json = (res, status, data) => { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
async function body(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 2_000_000) throw new Error('Richiesta troppo grande'); }
  return raw ? JSON.parse(raw) : {};
}

async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/dashboard') {
    const stats = one(`SELECT COUNT(*) total, COALESCE(SUM(status='new'),0) nuovi, COALESCE(SUM(status='qualified'),0) qualificati, COALESCE(SUM(status='contacted'),0) contattati, COALESCE(SUM(status='won'),0) acquisiti FROM leads`);
    const sectors = query(`SELECT COALESCE(NULLIF(category,''),'Altro') label, COUNT(*) value FROM leads GROUP BY category ORDER BY value DESC LIMIT 6`);
    const recent = query(`SELECT * FROM leads ORDER BY created_at DESC, id DESC LIMIT 8`);
    return json(res, 200, { stats, sectors, recent });
  }
  if (req.method === 'GET' && url.pathname === '/api/leads') {
    const search = `%${url.searchParams.get('q') || ''}%`;
    const status = url.searchParams.get('status') || '';
    const campaign = url.searchParams.get('campaign') || '';
    const leads = query(`SELECT l.*, c.name campaign_name FROM leads l LEFT JOIN campaigns c ON c.id=l.campaign_id WHERE (l.company LIKE $q OR l.city LIKE $q OR l.category LIKE $q) AND ($status='' OR l.status=$status) AND ($campaign='' OR l.campaign_id=$campaign) ORDER BY l.created_at DESC, l.id DESC LIMIT 500`, { $q:search, $status:status, $campaign:campaign });
    return json(res, 200, leads);
  }
  if (req.method === 'POST' && url.pathname === '/api/leads') {
    const data = await body(req); const result = upsertLead(data);
    return json(res, 201, { id: Number(result.lastInsertRowid), ok: true });
  }
  const leadMatch = url.pathname.match(/^\/api\/leads\/(\d+)$/);
  if (leadMatch && req.method === 'PATCH') {
    const data = await body(req);
    const allowed = ['status','notes','email','phone','website','category','city'];
    const fields = allowed.filter(k => data[k] !== undefined);
    if (!fields.length) return json(res, 400, { error:'Nessun campo valido' });
    const values = Object.fromEntries(fields.map(k => [`$${k}`, String(data[k])]));
    run(`UPDATE leads SET ${fields.map(k => `${k}=$${k}`).join(', ')}, updated_at=datetime('now') WHERE id=$id`, { ...values, $id:Number(leadMatch[1]) });
    return json(res, 200, { ok:true });
  }
  if (leadMatch && req.method === 'DELETE') { run('DELETE FROM leads WHERE id=?', [Number(leadMatch[1])]); return json(res, 200, { ok:true }); }
  if (req.method === 'GET' && url.pathname === '/api/campaigns') return json(res, 200, query('SELECT c.*, COUNT(l.id) lead_count FROM campaigns c LEFT JOIN leads l ON l.campaign_id=c.id GROUP BY c.id ORDER BY c.id DESC'));
  if (req.method === 'POST' && url.pathname === '/api/campaigns') {
    const data = await body(req); if (!data.name?.trim()) return json(res, 400, { error:'Nome obbligatorio' });
    const result = run('INSERT INTO campaigns(name,sector,location) VALUES(?,?,?)', [data.name.trim(), data.sector?.trim() || '', data.location?.trim() || '']);
    return json(res, 201, { id:Number(result.lastInsertRowid) });
  }
  if (req.method === 'POST' && url.pathname === '/api/discover') {
    const data = await body(req); const leads = await discoverOpenStreetMap(data);
    for (const lead of leads) upsertLead({ ...lead, campaign_id:data.campaign_id });
    return json(res, 200, { imported:leads.length, leads });
  }
  if (req.method === 'POST' && url.pathname === '/api/enrich') return json(res, 200, await enrichWebsite((await body(req)).url));
  if (req.method === 'POST' && url.pathname === '/api/import') {
    const data = await body(req); const rows = parseCsv(data.csv);
    for (const row of rows) upsertLead({ ...row, campaign_id:data.campaign_id, source:row.source || 'CSV' });
    return json(res, 200, { imported:rows.length });
  }
  return json(res, 404, { error:'Endpoint non trovato' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const path = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const file = resolve(join(publicDir, path));
    if (!file.startsWith(publicDir)) { res.writeHead(403); return res.end(); }
    const content = await readFile(file); res.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream' }); res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') { res.writeHead(404); return res.end('Non trovato'); }
    console.error(error); json(res, 500, { error:error.message || 'Errore interno' });
  }
});
server.listen(port, () => console.log(`LeadForge Italia attivo su http://localhost:${port}`));
