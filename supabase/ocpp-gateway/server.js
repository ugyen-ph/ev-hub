// ============================================
// EV Hub Bhutan - OCPP Gateway Server
// Main entry point - starts WebSocket server
//
// OCPP 1.6J security profile 1: chargers authenticate with HTTP Basic auth
// on the WebSocket upgrade (username = charge point identity, password from
// the CHARGERS env). In demo mode every connection is accepted.
// ============================================

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const WebSocket = require('ws');

const config = require('./config');
const OcppHandler = require('./ocpp-handler');

// Store connected chargers: chargePointId -> OcppHandler
const chargers = new Map();

// ---------- HTTP(S) server + WebSocket upgrade ----------

const useTls = Boolean(config.gateway.tlsKeyPath && config.gateway.tlsCertPath);
const server = useTls
  ? https.createServer({
      key: fs.readFileSync(config.gateway.tlsKeyPath),
      cert: fs.readFileSync(config.gateway.tlsCertPath),
    })
  : http.createServer();

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  const chargePointId = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

  if (!chargePointId || !authenticateCharger(chargePointId, req)) {
    console.log(`✗ Rejected connection (id: ${chargePointId || 'missing'}, auth failed)`);
    socket.write(
      'HTTP/1.1 401 Unauthorized\r\n' +
        'Connection: close\r\n' +
        'WWW-Authenticate: Basic realm="OCPP Gateway"\r\n' +
        '\r\n',
    );
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, chargePointId);
  });
});

server.listen(config.gateway.port, config.gateway.host, () => {
  console.log('========================================');
  console.log('  EV Hub Bhutan - OCPP Gateway');
  console.log('========================================');
  console.log(`  OCPP Version: ${config.ocpp.version}`);
  console.log(`  Port: ${config.gateway.port} (${useTls ? 'wss://' : 'ws://'})`);
  console.log(`  Demo Mode: ${config.demoMode ? 'ON' : 'OFF (Basic auth required)'}`);
  console.log(`  Offline watchdog: >${config.offline.afterMinutes} min without heartbeat`);
  console.log('========================================\n');
  console.log(`Gateway listening on ${useTls ? 'wss' : 'ws'}://${config.gateway.host}:${config.gateway.port}/{chargePointId}\n`);
  console.log('Gateway ready. Waiting for charger connections...\n');
});

// Handle new connections
wss.on('connection', (ws, req, chargePointId) => {
  console.log(`\n[${chargePointId}] New connection from ${req.socket.remoteAddress}`);

  // A reconnecting charger replaces its stale socket instead of leaking it
  const previous = chargers.get(chargePointId);
  if (previous) {
    console.log(`  Replacing stale connection for ${chargePointId}`);
    previous.connection.close();
    chargers.delete(chargePointId);
  }

  // Create handler for this charger
  const handler = new OcppHandler(ws, chargePointId);
  chargers.set(chargePointId, handler);

  // Handle messages
  ws.on('message', async (data) => {
    try {
      await handler.handleMessage(data.toString());
    } catch (error) {
      console.error(`  Error handling message:`, error.message);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    if (chargers.get(chargePointId) === handler) {
      console.log(`[${chargePointId}] Disconnected`);
      chargers.delete(chargePointId);
    }
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`[${chargePointId}] Error:`, error.message);
  });
});

// Authenticate charger (WS upgrade time)
function authenticateCharger(chargePointId, req) {
  // In demo mode, accept any charger
  if (config.demoMode) {
    return true;
  }
  // OCPP 1.6J: Basic auth, username = charge point identity
  return verifyCredentials(req, chargePointId);
}

function verifyCredentials(req, chargePointId) {
  const expectedPassword = config.chargers[chargePointId];
  if (!expectedPassword) return false; // unknown charger id

  const header = req.headers.authorization || '';
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) return false;

  let decoded;
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf8');
  } catch {
    return false;
  }

  const separator = decoded.indexOf(':');
  if (separator < 0) return false;

  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  // Hash both sides so timingSafeEqual always gets equal-length buffers
  const usernameOk = safeEqual(username, chargePointId);
  const passwordOk = safeEqual(password, expectedPassword);
  return usernameOk && passwordOk;
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---------- Offline watchdog ----------
// Marks OCPP-managed chargers 'offline' in Supabase when their heartbeat
// goes stale, so the app never shows "Available" for a dead charger.

setInterval(() => {
  require('./supabase-client')
    .sweepOfflineChargers(config.offline.afterMinutes)
    .then((count) => {
      if (count > 0) {
        console.log(`\n[watchdog] Marked ${count} stale charger(s) offline`);
      }
    })
    .catch((error) => console.error('[watchdog] Sweep failed:', error.message));
}, config.offline.sweepSeconds * 1000).unref();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gateway...');
  for (const handler of chargers.values()) {
    handler.connection.close();
  }
  chargers.clear();
  server.close(() => {
    console.log('Gateway stopped');
    process.exit(0);
  });
});
