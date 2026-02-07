const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'weekly-status.json');
const PORT = Number(process.env.PORT || 4173);
const MAX_BODY_BYTES = 1_000_000;

const DEFAULT_STATE = { weeks: {} };

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function isValidState(candidate) {
  return Boolean(candidate && typeof candidate === 'object' && candidate.weeks && typeof candidate.weeks === 'object');
}

function normalizeState(candidate) {
  return isValidState(candidate) ? candidate : { ...DEFAULT_STATE };
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
  }
}

async function readState() {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return normalizeState(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(state) {
  const normalized = normalizeState(state);
  await ensureDataFile();

  const tmpFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(normalized, null, 2));
  await fs.rename(tmpFile, DATA_FILE);

  return normalized;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(message);
}

async function readRequestBody(req) {
  let body = '';

  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY_BYTES) {
      throw new Error('Payload too large');
    }
  }

  return body;
}

function resolveFilePath(urlPathname) {
  let pathname = urlPathname;
  if (pathname === '/') pathname = '/index.html';

  const decoded = decodeURIComponent(pathname);
  const safePath = path.normalize(decoded).replace(/^([.][.][/\\])+/, '');
  const resolved = path.join(ROOT_DIR, safePath);

  if (!resolved.startsWith(ROOT_DIR)) {
    return null;
  }

  return resolved;
}

async function serveStatic(req, res, pathname) {
  const resolvedPath = resolveFilePath(pathname);
  if (!resolvedPath) {
    sendText(res, 400, 'Bad request');
    return;
  }

  try {
    const stat = await fs.stat(resolvedPath);
    if (stat.isDirectory()) {
      sendText(res, 403, 'Forbidden');
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const data = await fs.readFile(resolvedPath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    res.end(data);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/state') {
      if (req.method === 'GET') {
        const state = await readState();
        sendJson(res, 200, state);
        return;
      }

      if (req.method === 'PUT') {
        try {
          const body = await readRequestBody(req);
          const parsed = JSON.parse(body);
          if (!isValidState(parsed)) {
            sendJson(res, 400, { error: 'Invalid state payload' });
            return;
          }

          const saved = await writeState(parsed);
          sendJson(res, 200, saved);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid request';
          const status = message === 'Payload too large' ? 413 : 400;
          sendJson(res, status, { error: message });
        }
        return;
      }

      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendText(res, 405, 'Method not allowed');
      return;
    }

    await serveStatic(req, res, url.pathname);
  } catch {
    sendJson(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, async () => {
  await ensureDataFile();
  // eslint-disable-next-line no-console
  console.log(`Weekly Status Tracker running at http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Data file: ${DATA_FILE}`);
});
