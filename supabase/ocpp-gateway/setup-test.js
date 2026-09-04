// ============================================
// Setup test charger in database
// ============================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function setup() {
  console.log('Setting up test charger...\n');

  // Find first charger without a charge_point_id
  const { data: chargers, error } = await supabase
    .from('chargers')
    .select('*')
    .is('charge_point_id', null)
    .limit(1);

  if (error) {
    console.error('Error finding charger:', error.message);
    process.exit(1);
  }

  if (!chargers || chargers.length === 0) {
    console.log('No available charger found. All chargers have charge_point_id set.');
    console.log('Please clear a charge_point_id in Admin Dashboard first.');
    process.exit(1);
  }

  const charger = chargers[0];
  console.log(`Found charger: ${charger.label} (ID: ${charger.id})`);

  // Update with test charge_point_id
  const { error: updateError } = await supabase
    .from('chargers')
    .update({ charge_point_id: 'TEST-CP-001' })
    .eq('id', charger.id);

  if (updateError) {
    console.error('Error updating charger:', updateError.message);
    process.exit(1);
  }

  console.log('✓ Charger updated with charge_point_id: TEST-CP-001');
  console.log('\nYou can now run the test:');
  console.log('  Terminal 1: npm start');
  console.log('  Terminal 2: npm run test');
}

setup();
