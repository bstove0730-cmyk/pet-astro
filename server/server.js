const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3477;
const API_BASE = process.env.API_BASE || ''; // e.g. 'https://pet-astro.onrender.com'
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const ADMIN = path.join(ROOT, 'admin');
// Data directory: use FLY_VOLUME_DATA if set (Fly.io), otherwise local ./data
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'reports.json');

// ── Database ──
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ reports: [] }));

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); }
  catch { return { reports: [] }; }
}
function saveDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

// ── MIME types ──
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ── Serve static file ──
function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// ── API Handlers ──

// POST /api/report
function handleSaveReport(req, res, body) {
  try {
    const data = JSON.parse(body);
    const reportId = 'PET' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const report = {
      id: reportId,
      petName: data.petName || '',
      species: data.species || 'dog',
      breed: data.breed || '',
      birthDate: data.birthDate || '',
      birthTime: data.birthTime || '',
      city: data.city || '',
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      sunSign: data.sunSign || '',
      sunDegree: data.sunDegree || null,
      moonSign: data.moonSign || '',
      moonDegree: data.moonDegree || null,
      risingSign: data.risingSign || '',
      risingDegree: data.risingDegree || null,
      rawData: data,
      clientIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
      userAgent: req.headers['user-agent'] || '',
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    
    const db = loadDB();
    db.reports.unshift(report);
    saveDB(db);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, reportId }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

// GET /api/reports
function handleListReports(req, res) {
  try {
    const parsed = url.parse(req.url, true);
    const page = parseInt(parsed.query.page) || 1;
    const limit = parseInt(parsed.query.limit) || 20;
    const search = (parsed.query.search || '').toLowerCase();
    
    const db = loadDB();
    let reports = db.reports;
    
    if (search) {
      reports = reports.filter(r => 
        (r.petName || '').toLowerCase().includes(search) ||
        (r.city || '').toLowerCase().includes(search) ||
        (r.breed || '').toLowerCase().includes(search) ||
        (r.id || '').toLowerCase().includes(search)
      );
    }
    
    const total = reports.length;
    const totalPages = Math.ceil(total / limit);
    const paged = reports.slice((page - 1) * limit, page * limit);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, reports: paged, pagination: { page, limit, total, totalPages } }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

// GET /api/report/:id
function handleGetReport(req, res, id) {
  try {
    const db = loadDB();
    const report = db.reports.find(r => r.id === id);
    if (!report) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, report }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

// GET /api/stats
function handleStats(req, res) {
  try {
    const db = loadDB();
    const reports = db.reports;
    const now = new Date();
    
    const today = reports.filter(r => new Date(r.createdAt).toDateString() === now.toDateString()).length;
    const thisWeek = reports.filter(r => (now - new Date(r.createdAt)) < 7 * 86400000).length;
    
    const petCounts = {}, cityCounts = {}, signCounts = {}, dailyCounts = {};
    reports.forEach(r => {
      if (r.petName) petCounts[r.petName] = (petCounts[r.petName] || 0) + 1;
      if (r.city) cityCounts[r.city] = (cityCounts[r.city] || 0) + 1;
      if (r.sunSign) signCounts[r.sunSign] = (signCounts[r.sunSign] || 0) + 1;
      const day = r.createdAt.substring(0, 10);
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });
    
    const topPets = Object.entries(petCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, c]) => ({ name: n, count: c }));
    const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, n]) => ({ city: c, count: n }));
    const signStats = Object.entries(signCounts).sort((a, b) => b[1] - a[1]).map(([s, c]) => ({ sign: s, count: c }));
    const dailyStats = Object.entries(dailyCounts).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30).map(([d, c]) => ({ date: d, count: c }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, stats: { total: reports.length, today, thisWeek, topPets, topCities, signStats, dailyStats } }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

// DELETE /api/report/:id
function handleDeleteReport(req, res, id) {
  try {
    const db = loadDB();
    const idx = db.reports.findIndex(r => r.id === id);
    if (idx === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Not found' }));
      return;
    }
    db.reports.splice(idx, 1);
    saveDB(db);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

// ── Router ──
function collectBody(req, cb) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => cb(body));
}

function addCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const server = http.createServer((req, res) => {
  addCORS(res);
  
  // Handle preflight CORS requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;
  const method = req.method;
  
  // ── API routes ──
  if (pathname === '/api/report' && method === 'POST') {
    return collectBody(req, body => handleSaveReport(req, res, body));
  }
  if (pathname === '/api/reports' && method === 'GET') {
    return handleListReports(req, res);
  }
  if (pathname === '/api/stats' && method === 'GET') {
    return handleStats(req, res);
  }
  if (pathname.startsWith('/api/report/') && method === 'GET') {
    const id = pathname.split('/api/report/')[1];
    return handleGetReport(req, res, id);
  }
  if (pathname.startsWith('/api/report/') && method === 'DELETE') {
    const id = pathname.split('/api/report/')[1];
    return handleDeleteReport(req, res, id);
  }
  
  // ── Static files ──
  let filePath;
  if (pathname.startsWith('/admin')) {
    const subPath = pathname.replace('/admin', '') || '/index.html';
    filePath = path.join(ADMIN, subPath === '/' ? '/index.html' : subPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(ADMIN, 'index.html');
    }
  } else {
    filePath = path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath)) filePath = path.join(PUBLIC, 'index.html');
  }
  
  serveFile(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🐾 宠物星盘后端服务启动成功！
  ─────────────────────────────
  🌐 前端:       http://localhost:${PORT}
  📊 管理后台:   http://localhost:${PORT}/admin
  📡 API:        http://localhost:${PORT}/api/reports
  ─────────────────────────────
  `);
});
