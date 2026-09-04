// ============================================
// EV Hub Bhutan - Supabase Client
// Handles all database operations for the gateway
// ============================================

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

class SupabaseClient {
  constructor() {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  /**
   * Find charger by charge_point_id
   */
  async findCharger(chargePointId) {
    const { data, error } = await this.supabase
      .from('chargers')
      .select('*')
      .eq('charge_point_id', chargePointId)
      .single();

    if (error) {
      console.error(`Error finding charger ${chargePointId}:`, error.message);
      return null;
    }

    return data;
  }

  /**
   * Update charger status (from OCPP StatusNotification)
   * Maps OCPP status to our database status
   */
  async updateChargerStatus(chargePointId, ocppStatus) {
    const statusMap = {
      'Available': 'available',
      'Occupied': 'busy',
      'Charging': 'busy',
      'Reserved': 'reserved',
      'Unavailable': 'offline',
      'Faulted': 'faulted',
      'Preparing': 'busy',
      'SuspendedEV': 'busy',
      'SuspendedEVSE': 'busy',
      'Finishing': 'busy',
    };

    const status = statusMap[ocppStatus] || ocppStatus.toLowerCase();

    const { error } = await this.supabase
      .from('chargers')
      .update({
        status: status,
        status_source: 'ocpp',
        last_status_change: new Date().toISOString(),
      })
      .eq('charge_point_id', chargePointId);

    if (error) {
      console.error(`Error updating status for ${chargePointId}:`, error.message);
      return false;
    }

    console.log(`  ✓ Charger ${chargePointId} status → ${status}`);
    return true;
  }

  /**
   * Create a new charging session (from OCPP StartTransaction)
   * Returns the numeric transaction ID for OCPP reference
   */
  async createSession(chargePointId, transactionId, meterStart, userId = null) {
    // First find the charger
    const charger = await this.findCharger(chargePointId);
    if (!charger) {
      console.error(`Cannot create session: charger ${chargePointId} not found`);
      return null;
    }

    // Generate numeric transaction ID if not provided (OCPP uses integers)
    const ocppTxnId = transactionId || Math.floor(Math.random() * 1000000);

    const { data, error } = await this.supabase
      .from('charging_sessions')
      .insert({
        charger_id: charger.id,
        user_id: userId,
        ocpp_transaction_id: ocppTxnId,
        meter_start_kwh: meterStart || 0,
        status: 'started',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error(`Error creating session for ${chargePointId}:`, error.message);
      return null;
    }

    console.log(`  ✓ Session created: transaction ${ocppTxnId}`);
    return { ...data, ocppTransactionId: ocppTxnId };
  }

  /**
   * Update charging session with meter values
   */
  async updateSessionMeter(transactionId, meterValue) {
    const { error } = await this.supabase
      .from('charging_sessions')
      .update({
        meter_stop_kwh: meterValue,
      })
      .eq('ocpp_transaction_id', transactionId);

    if (error) {
      console.error(`Error updating meter for transaction ${transactionId}:`, error.message);
      return false;
    }

    console.log(`  ✓ Transaction ${transactionId} meter → ${meterValue} kWh`);
    return true;
  }

  /**
   * Complete a charging session (from OCPP StopTransaction)
   */
  async completeSession(transactionId, meterStop, costNu = null) {
    // Calculate cost if not provided (example: 5 NU per kWh)
    const cost = costNu || (meterStop * 5);

    const { error } = await this.supabase
      .from('charging_sessions')
      .update({
        meter_stop_kwh: meterStop,
        cost_nu: cost,
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('ocpp_transaction_id', transactionId);

    if (error) {
      console.error(`Error completing transaction ${transactionId}:`, error.message);
      return false;
    }

    console.log(`  ✓ Transaction ${transactionId} completed: ${meterStop} kWh, ${cost} NU`);
    return true;
  }

  /**
   * Log heartbeat from charger
   */
  async logHeartbeat(chargePointId) {
    const { error } = await this.supabase
      .from('chargers')
      .update({
        last_status_change: new Date().toISOString(),
      })
      .eq('charge_point_id', chargePointId);

    if (error) {
      console.error(`Error logging heartbeat for ${chargePointId}:`, error.message);
    }
  }
}

module.exports = new SupabaseClient();
