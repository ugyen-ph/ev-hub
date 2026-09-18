// ============================================
// EV Hub Bhutan - Fake Charger (Test Tool)
// Simulates a real OCPP charger for testing
// ============================================

const WebSocket = require('ws');

const GATEWAY_URL = 'ws://localhost:8080';
const CHARGE_POINT_ID = 'TEST-CP-001';

console.log('========================================');
console.log('  EV Hub Bhutan - Fake Charger Test');
console.log('========================================');
console.log(`  Gateway: ${GATEWAY_URL}`);
console.log(`  Charger ID: ${CHARGE_POINT_ID}`);
console.log('========================================\n');

// Connect to gateway
const ws = new WebSocket(`${GATEWAY_URL}/${CHARGE_POINT_ID}`);

let messageId = 1;

// Send OCPP message
function sendOcpp(action, payload = {}) {
  const msg = [2, messageId.toString(), action, payload];
  ws.send(JSON.stringify(msg));
  console.log(`\n[${CHARGE_POINT_ID}] → ${action}`);
  messageId++;
}

ws.on('open', async () => {
  console.log('Connected to gateway!\n');

  // Step 1: BootNotification
  console.log('--- Step 1: BootNotification ---');
  sendOcpp('BootNotification', {
    chargePointVendor: 'EV Hub Test',
    chargePointModel: 'Simulator v1.0',
    chargePointSerialNumber: 'TEST-001',
  });

  await sleep(2000);

  // Step 2: StatusNotification - Available
  console.log('\n--- Step 2: Status = Available ---');
  sendOcpp('StatusNotification', {
    connectorId: 1,
    status: 'Available',
    errorCode: 'NoError',
  });

  await sleep(2000);

  // Step 3: Heartbeat
  console.log('\n--- Step 3: Heartbeat ---');
  sendOcpp('Heartbeat', {});

  await sleep(2000);

  // Step 4: Authorize (user scans card)
  console.log('\n--- Step 4: Authorize User ---');
  sendOcpp('Authorize', {
    idTag: 'USER-001',
  });

  await sleep(2000);

  // Step 5: StartTransaction
  console.log('\n--- Step 5: Start Charging ---');
  sendOcpp('StartTransaction', {
    connectorId: 1,
    idTag: 'USER-001',
    meterStart: 50000, // OCPP 1.6: Wh (50.000 kWh)
    timestamp: new Date().toISOString(),
  });

  await sleep(3000);

  // Step 6: MeterValues (periodic readings, in Wh — the OCPP 1.6 default)
  console.log('\n--- Step 6: Meter Values ---');
  const readings = [52300, 55700, 60200, 65800, 70100]; // Wh
  for (const reading of readings) {
    sendOcpp('MeterValues', {
      connectorId: 1,
      transactionId: null,
      meterValue: [{
        timestamp: new Date().toISOString(),
        sampledValue: [{ value: reading.toString() }], // no unit → default Wh
      }],
    });
    await sleep(2000);
  }

  // Step 7: StatusNotification - Occupied
  console.log('\n--- Step 7: Status = Occupied ---');
  sendOcpp('StatusNotification', {
    connectorId: 1,
    status: 'Occupied',
    errorCode: 'NoError',
  });

  await sleep(2000);

  // Step 8: StopTransaction
  console.log('\n--- Step 8: Stop Charging ---');
  sendOcpp('StopTransaction', {
    transactionId: null,
    meterStop: 75500, // Wh (75.500 kWh) → session delivered 25.500 kWh
    timestamp: new Date().toISOString(),
    idTag: 'USER-001',
  });

  await sleep(2000);

  // Step 9: StatusNotification - Available again
  console.log('\n--- Step 9: Status = Available ---');
  sendOcpp('StatusNotification', {
    connectorId: 1,
    status: 'Available',
    errorCode: 'NoError',
  });

  await sleep(2000);

  // Step 10: Final Heartbeat
  console.log('\n--- Step 10: Final Heartbeat ---');
  sendOcpp('Heartbeat', {});

  console.log('\n========================================');
console.log('  Test Complete!');
console.log('========================================');
console.log('\nCheck your:');
console.log('  1. Mobile App - charger status changes');
console.log('  2. Admin Dashboard - OCPP-locked charger');
console.log('  3. Analytics - kWh data from session');
console.log('  4. Database - charging_sessions table');
console.log('\n');

  ws.close();
  process.exit(0);
});

ws.on('message', (data) => {
  try {
    const response = JSON.parse(data);
    if (response[0] === 3) {
      console.log(`  ← Response: ${JSON.stringify(response[2])}`);
    }
  } catch (e) {
    // ignore parse errors
  }
});

ws.on('error', (error) => {
  console.error('\nConnection error:', error.message);
  console.log('\nMake sure the gateway is running:');
  console.log('  cd supabase/ocpp-gateway');
  console.log('  npm start');
  process.exit(1);
});

ws.on('close', () => {
  console.log('\nDisconnected from gateway');
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
