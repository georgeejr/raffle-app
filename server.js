const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'stpaul_raffle.db');
const PORT = 3001;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /api/db -> returns the raw binary SQLite database file from disk
  if (req.method === 'GET' && req.url === '/api/db') {
    if (fs.existsSync(DB_PATH)) {
      try {
        const data = fs.readFileSync(DB_PATH);
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': data.length
        });
        res.end(data);
        return;
      } catch (err) {
        console.error('[Server] Error reading db file:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database file not found on disk' }));
      return;
    }
  }

  // POST /api/db -> saves the raw binary SQLite database to disk
  if (req.method === 'POST' && req.url === '/api/db') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      try {
        fs.writeFileSync(DB_PATH, buffer);
        console.log(`[Storage Server] Saved database to ${DB_PATH} (${(buffer.length / 1024).toFixed(1)} KB)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, size: buffer.length }));
      } catch (err) {
        console.error('[Storage Server] Failed to write database to disk:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /api/health -> check server status and if disk file exists
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      dbFilePath: DB_PATH,
      dbFileExists: fs.existsSync(DB_PATH),
      size: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  St. Paul Raffle Local SQLite Storage Server`);
  console.log(`  Running at: http://localhost:${PORT}`);
  console.log(`  Database File: ${DB_PATH}`);
  console.log(`======================================================\n`);
});

