// ============================================
// EV Hub Bhutan - OCPP Gateway Configuration
// ============================================

require('dotenv').config();

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
  },

  // OCPP protocol settings
  ocpp: {
    version: process.env.OCPP_VERSION || '1.6',
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 60,
  },

  // Charger authentication (charge_point_id -> password)
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

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
}

// Validate on load
validateConfig();

module.exports = config;
