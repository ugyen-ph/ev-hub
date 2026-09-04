// ============================================
// EV Hub Bhutan - OCPP Gateway Server
// Main entry point - starts WebSocket server
// ============================================

const WebSocket = require('ws');
const config = require('./config');
const OcppHandler = require('./ocpp-handler');

console.log('========================================');
console.log('  EV Hub Bhutan - OCPP Gateway');
console.log('========================================');
console.log(`  OCPP Version: ${config.ocpp.version}`);
console.log(`  Port: ${config.gateway.port}`);
console.log(`  Demo Mode: ${config.demoMode ? 'ON' : 'OFF'}`);
console.log('========================================\n');

// Store connected chargers
const chargers = new Map();

// Create WebSocket server
const wss = new WebSocket.Server({
  port: config.gateway.port,
  host: config.gateway.host,
});

console.log(`Gateway listening on ws://${config.gateway.host}:${config.gateway.port}\n`);

// Handle new connections
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const chargePointId = url.pathname.slice(1) || 'unknown';

  console.log(`\n[${chargePointId}] New connection from ${req.socket.remoteAddress}`);

  // Authenticate charger
  if (!authenticateCharger(chargePointId)) {
    console.log(`  ✗ Authentication failed`);
    ws.close(1008, 'Invalid charger identity');
    return;
  }

  console.log(`  ✓ Authenticated`);

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
    console.log(`[${chargePointId}] Disconnected`);
    chargers.delete(chargePointId);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`[${chargePointId}] Error:`, error.message);
    chargers.delete(chargePointId);
  });
});

// Authenticate charger
function authenticateCharger(chargePointId) {
  // In demo mode, accept any charger
  if (config.demoMode) {
    return true;
  }
  // Otherwise check against configured chargers
  return config.chargers.hasOwnProperty(chargePointId);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gateway...');
  wss.close(() => {
    console.log('Gateway stopped');
    process.exit(0);
  });
});

console.log('Gateway ready. Waiting for charger connections...\n');
