// ============================================
// EV Hub Bhutan - Verify Fake-Charger Results
// Checks the database after test/fake-charger.js ran:
//   - charger TEST-CP-001 is OCPP-managed and available again
//   - a completed session exists with kWh + cost correctly computed
// Run: node test/verify-results.js
// ============================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const CHARGE_POINT_ID = 'TEST-CP-001';

async function main() {
  console.log(`Verifying results for ${CHARGE_POINT_ID}...\n`);

  let charger, chargerError;
  {
    const res = await supabase
      .from('chargers')
      .select('id, label, status, status_source, charge_point_id, connector_statuses, last_heartbeat')
      .eq('charge_point_id', CHARGE_POINT_ID)
      .maybeSingle();
    charger = res.data;
    chargerError = res.error;
  }

  let legacySchema = false;
  if (chargerError && chargerError.message.includes('connector_statuses')) {
    // Pre-0007 database — retry without the new columns
    legacySchema = true;
    const res = await supabase
      .from('chargers')
      .select('id, label, status, status_source, charge_point_id')
      .eq('charge_point_id', CHARGE_POINT_ID)
      .maybeSingle();
    charger = res.data;
    chargerError = res.error;
  }

  if (chargerError || !charger) {
    console.error(`✗ Charger ${CHARGE_POINT_ID} not found`, chargerError?.message ?? '');
    process.exit(1);
  }

  console.log(`(schema mode: ${legacySchema ? 'pre-0007 (apply migration 20260902000007)' : '0007-applied'})\n`);

  console.log('Charger:');
  console.log(`  label:             ${charger.label}`);
  console.log(`  status:            ${charger.status}`);
  console.log(`  status_source:     ${charger.status_source}`);
  if (!legacySchema) {
    console.log(`  connector_statuses: ${JSON.stringify(charger.connector_statuses ?? {})}`);
    console.log(`  last_heartbeat:    ${charger.last_heartbeat}`);
  }

  const { data: session, error: sessionError } = await supabase
    .from('charging_sessions')
    .select('id, ocpp_transaction_id, meter_start_kwh, meter_stop_kwh, cost_nu, status, started_at, ended_at')
    .eq('charger_id', charger.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError || !session) {
    console.error(`\n✗ No charging session found`, sessionError?.message ?? '');
    process.exit(1);
  }

  console.log('\nLatest charging session:');
  console.log(`  ocpp_transaction_id: ${session.ocpp_transaction_id}`);
  console.log(`  meter_start_kwh:     ${session.meter_start_kwh}`);
  console.log(`  meter_stop_kwh:      ${session.meter_stop_kwh}`);
  console.log(`  cost_nu:             ${session.cost_nu}`);
  console.log(`  status:              ${session.status}`);
  console.log(`  started_at:          ${session.started_at}`);
  console.log(`  ended_at:            ${session.ended_at}`);

  // ---- assertions ----
  const checks = [
    ['status_source is ocpp', charger.status_source === 'ocpp'],
    ['charger back to available', charger.status === 'available'],
    ['transaction id assigned', session.ocpp_transaction_id !== null],
    ['meter_start = 50 kWh (from 50,000 Wh)', Number(session.meter_start_kwh) === 50],
    ['meter_stop = 75.5 kWh (from 75,500 Wh)', Number(session.meter_stop_kwh) === 75.5],
    ['cost = 25.5 kWh × tariff = 127.5 NU', Number(session.cost_nu) === 127.5],
    ['session completed', session.status === 'completed'],
  ];

  console.log('\nChecks:');
  let failures = 0;
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✓' : '✗'} ${name}`);
    if (!ok) failures++;
  }

  console.log(
    failures === 0
      ? '\n✅ ALL CHECKS PASSED — gateway, Wh→kWh conversion and pricing verified.'
      : `\n❌ ${failures} check(s) failed — see above.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();