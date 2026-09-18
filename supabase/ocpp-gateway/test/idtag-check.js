// ============================================
// EV Hub Bhutan - idTag → User Mapping Check
// Live test against the running gateway: authorizes a REAL driver's idTag,
// starts/stops a session, then verifies the session row is linked to the
// driver's profile (user_id).
// Usage: node test/idtag-check.js [idTag]   (defaults to the first profile)
// ============================================

const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://localhost:8080';
const CHARGE_POINT_ID = 'TEST-CP-001';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Pick a tag: argument, else the first profile that has one
  let tag = process.argv[2];
  if (!tag) {
    const { data } = await supabase.from('profiles').select('id_tag, full_name').not('id_tag', 'is', null).limit(1);
    tag = data?.[0]?.id_tag;
    if (!tag) {
      console.error('No profile with an id_tag found (create a user in the app first).');
      process.exit(1);
    }
  }
  const { data: profile } = await supabase.from('profiles').select('id, full_name').eq('id_tag', tag).maybeSingle();
  console.log(`Testing idTag ${tag} → driver "${profile?.full_name ?? '?'}"\n`);

  let mid = 1;
  const ws = new WebSocket(`${GATEWAY_URL}/${CHARGE_POINT_ID}`);
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m[0] === 3) console.log(`  ← ${JSON.stringify(m[2])}`);
  });

  ws.on('open', async () => {
    send('BootNotification', { chargePointVendor: 'EV Hub', chargePointModel: 'idTag Check' });
    await sleep(800);
    send('Authorize', { idTag: tag });
    await sleep(800);
    send('StartTransaction', { connectorId: 1, idTag: tag, meterStart: 10000, timestamp: new Date().toISOString() }); // 10 kWh
    await sleep(1500);
    send('StopTransaction', { transactionId: null, meterStop: 15000, timestamp: new Date().toISOString() }); // 15 kWh → 5 kWh delivered
    await sleep(1200);
    ws.close();

    const ses = await supabase
      .from('charging_sessions')
      .select('ocpp_transaction_id, user_id, meter_start_kwh, meter_stop_kwh, cost_nu, status')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('\nLatest session:', JSON.stringify(ses.data, null, 2));

    const linked = ses.data && ses.data.user_id === profile?.id;
    console.log(linked
      ? `\n✅ Session linked to driver (${profile.full_name || profile.id}) — idTag mapping works.`
      : `\n❌ Session NOT linked to driver — check gateway logs.`);
    process.exit(linked ? 0 : 1);
  });

  function send(action, payload) {
    ws.send(JSON.stringify([2, String(mid++), action, payload]));
    console.log(`  → ${action}`);
  }

  ws.on('error', (e) => {
    console.error('Connection error:', e.message, '— is the gateway running (npm start)?');
    process.exit(1);
  });
}

main();