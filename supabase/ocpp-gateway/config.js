// ============================================
// EV Hub Bhutan - OCPP Gateway Configuration
// ============================================

require('dotenv').config();

const fs = require('fs');

const config = {
  // Supabase connection
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },

  // Gateway server settings
  gateway: {
    port: parseInt(process.env.GATEWAY_PORT) || 8080,
    host: '0.0.0.0',
    // Optional TLS termination (wss://). When both are set the gateway
    // serves https+wss itself; otherwise run it behind a reverse proxy
    // (nginx/caddy) and point chargers at wss://your-domain/ocpp.
    tlsKeyPath: process.env.TLS_KEY_PATH || null,
    tlsCertPath: process.env.TLS_CERT_PATH || null,
  },

  // OCPP protocol settings
  ocpp: {
    version: process.env.OCPP_VERSION || '1.6',
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 60,
  },

  // Offline watchdog: chargers whose last heartbeat is older than this are
  // marked 'offline' (status_source = 'ocpp' rows only). Real chargers
  // heartbeat every ~60s by default, so 10 minutes means 10 missed beats.
  offline: {
    afterMinutes: parseFloat(process.env.OFFLINE_AFTER_MINUTES) || 10,
    sweepSeconds: parseInt(process.env.OFFLINE_SWEEP_SECONDS) || 60,
  },

  // Fallback price (NU/kWh) when a station has no tariff configured.
  tariffFallbackNu: parseFloat(process.env.TARIFF_FALLBACK_NU) || 5,

  // Charger authentication (charge_point_id -> password).
  // OCPP 1.6J security profile 1: HTTP Basic auth on the WebSocket upgrade,
  // username = charge point identity. In demo mode auth is skipped.
  chargers: parseChargerConfig(process.env.CHARGERS),

  // Demo mode (no real chargers needed)
  demoMode: process.env.DEMO_MODE === 'true',
};

/**
 * Parse charger config from env string
 * Format: "id1:pass1,id2:pass2"
 */
function parseChargerConfig(chargersString) {
  const chargers = {};
  
  if (!chargersString) {
    return chargers;
  }

  const pairs = chargersString.split(',');
  for (const pair of pairs) {
    const [id, password] = pair.split(':');
    if (id && password) {
      chargers[id.trim()] = password.trim();
    }
  }

  return chargers;
}

/**
 * Validate configuration
 */
function validateConfig() {
  const errors = [];

  if (!config.supabase.url) {
    errors.push('SUPABASE_URL is required');
  }

  if (!config.supabase.serviceKey) {
    errors.push('SUPABASE_SERVICE_KEY is required');
  }

  if (!config.demoMode && Object.keys(config.chargers).length === 0) {
    errors.push('DEMO_MODE is false but CHARGERS is empty — add "id:password" pairs');
  }

  // TLS is opt-in: either both paths or neither
  if (Boolean(config.gateway.tlsKeyPath) !== Boolean(config.gateway.tlsCertPath)) {
    errors.push('TLS_KEY_PATH and TLS_CERT_PATH must be set together (or neither)');
  } else if (config.gateway.tlsKeyPath && !fs.existsSync(config.gateway.tlsKeyPath)) {
    errors.push(`TLS key not found: ${config.gateway.tlsKeyPath}`);
  } else if (config.gateway.tlsCertPath && !fs.existsSync(config.gateway.tlsCertPath)) {
    errors.push(`TLS certificate not found: ${config.gateway.tlsCertPath}`);
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
}

// Validate on load
validateConfig();

module.exports = config;
