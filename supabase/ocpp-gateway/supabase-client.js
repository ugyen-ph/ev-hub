// ============================================
// EV Hub Bhutan - Supabase Client
// Handles all database operations for the gateway
//
// The gateway writes with the SERVICE key (bypasses RLS by design — chargers
// are not interactive users). Requires migration 0007 for: the transaction
// id sequence, chargers.last_heartbeat / connector_statuses, station tariffs
// and profiles.id_tag.
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
    this.warnedLegacySchema = false;
  }

  warnLegacySchemaOnce(error) {
    if (this.warnedLegacySchema) return;
    this.warnedLegacySchema = true;
    console.error(
      `\n  ⚠ Database is missing OCPP columns (${error.message}).\n` +
      `    → Apply supabase/migrations/20260902000007_ocpp_gateway_hardening.sql\n` +
      `      (Supabase Dashboard → SQL Editor). Some writes will fail until then.\n`,
    );
  }

  /**
   * Find charger by charge_point_id (with its station's tariff)
   */
  async findCharger(chargePointId) {
    let { data, error } = await this.supabase
      .from('chargers')
      .select('*, station:stations(id, tariff_nu_per_kwh)')
      .eq('charge_point_id', chargePointId)
      .single();

    if (error && error.message.includes('tariff_nu_per_kwh')) {
      // Pre-0007 database: retry without the tariff embed
      this.warnLegacySchemaOnce(error);
      ({ data, error } = await this.supabase
        .from('chargers')
        .select('*')
        .eq('charge_point_id', chargePointId)
        .single());
      if (data) data.station = null;
    }

    if (error) {
      console.error(`Error finding charger ${chargePointId}:`, error.message);
      return null;
    }

    return data;
  }

  /**
   * OCPP idTag → profile (driver). Tags live on profiles.id_tag and are shown
   * on the mobile Profile screen.
   */
  async findProfileByIdTag(idTag) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id_tag', idTag)
      .maybeSingle();

    if (error) {
      console.error(`Error looking up idTag ${idTag}:`, error.message);
      return null;
    }

    return data;
  }

  /**
   * Update charger status (from OCPP StatusNotification / transaction events)
   * + persist the per-connector snapshot so the dashboard can inspect it.
   */
  async updateChargerStatus(chargePointId, status, connectorStatuses = undefined) {
    const update = {
      status: status,
      status_source: 'ocpp',
      last_status_change: new Date().toISOString(),
    };
    if (connectorStatuses !== undefined) {
      update.connector_statuses = connectorStatuses;
    }

    let { error } = await this.supabase
      .from('chargers')
      .update(update)
      .eq('charge_point_id', chargePointId);

    if (error && error.message.includes('connector_statuses')) {
      // Pre-0007 database: retry without the new columns
      this.warnLegacySchemaOnce(error);
      delete update.connector_statuses;
      ({ error } = await this.supabase
        .from('chargers')
        .update(update)
        .eq('charge_point_id', chargePointId));
    }

    if (error) {
      console.error(`Error updating status for ${chargePointId}:`, error.message);
      return false;
    }

    console.log(`  ✓ Charger ${chargePointId} status → ${status}`);
    return true;
  }

  /**
   * Log heartbeat from charger (powers the offline watchdog)
   */
  async logHeartbeat(chargePointId) {
    const update = { last_heartbeat: new Date().toISOString() };
    let { error } = await this.supabase
      .from('chargers')
      .update(update)
      .eq('charge_point_id', chargePointId);

    if (error && error.message.includes('last_heartbeat')) {
      this.warnLegacySchemaOnce(error);
      ({ error } = await this.supabase
        .from('chargers')
        .update({ last_status_change: new Date().toISOString() })
        .eq('charge_point_id', chargePointId));
    }

    if (error) {
      console.error(`Error logging heartbeat for ${chargePointId}:`, error.message);
      return false;
    }
    return true;
  }

  /**
   * Offline watchdog sweep: OCPP-managed chargers that stopped heartbeating
   * are marked offline so the app never advertises a dead charger.
   */
  async sweepOfflineChargers(afterMinutes) {
    const cutoff = new Date(Date.now() - afterMinutes * 60 * 1000).toISOString();

    const update = { status: 'offline' };
    let query = this.supabase
      .from('chargers')
      .update(update)
      .eq('status_source', 'ocpp')
      .neq('status', 'offline')
      .lt('last_heartbeat', cutoff);

    let { data, error } = await query.select('id');

    if (error && error.message.includes('last_heartbeat')) {
      this.warnLegacySchemaOnce(error);
      ({ data, error } = await this.supabase
        .from('chargers')
        .update(update)
        .eq('status_source', 'ocpp')
        .neq('status', 'offline')
        .lt('last_status_change', cutoff)
        .select('id'));
    }

    if (error) {
      throw new Error(error.message);
    }
    return data ? data.length : 0;
  }

  /**
   * Create a new charging session (from OCPP StartTransaction)
   *
   * When the charger didn't send a transaction id, the column is omitted and
   * the DB default (charging_session_txn_seq, migration 0007) allocates one —
   * no more Math.random() collisions. The unique index guarantees one row per
   * OCPP transaction id.
   */
  async createSession(chargePointId, transactionId, meterStartKwh, userId = null) {
    // First find the charger
    const charger = await this.findCharger(chargePointId);
    if (!charger) {
      console.error(`Cannot create session: charger ${chargePointId} not found`);
      return null;
    }

    const insert = {
      charger_id: charger.id,
      user_id: userId,
      meter_start_kwh: meterStartKwh ?? 0,
      status: 'started',
      started_at: new Date().toISOString(),
    };
    if (transactionId !== null && transactionId !== undefined && transactionId !== '') {
      insert.ocpp_transaction_id = Number(transactionId);
    }

    let { data, error } = await this.supabase
      .from('charging_sessions')
      .insert(insert)
      .select()
      .single();

    if (error && error.message.includes('ocpp_transaction_id')) {
      this.warnLegacySchemaOnce(error);
      delete insert.ocpp_transaction_id;
      ({ data, error } = await this.supabase
        .from('charging_sessions')
        .insert(insert)
        .select()
        .single());
    }

    if (error) {
      console.error(`Error creating session for ${chargePointId}:`, error.message);
      return null;
    }

    // Post-0007 the DB already assigned an id. On a pre-0007 database the row
    // comes back with NULL — give it a time-based id (13+3 digits, well inside
    // bigint) so meter updates below can find exactly one row.
    if (data && (data.ocpp_transaction_id === null || data.ocpp_transaction_id === undefined)) {
      const fallbackId = Number(`${Date.now()}${Math.floor(Math.random() * 900) + 100}`);
      const { error: idError } = await this.supabase
        .from('charging_sessions')
        .update({ ocpp_transaction_id: fallbackId })
        .eq('id', data.id);
      if (idError) {
        console.error(`Could not assign fallback transaction id:`, idError.message);
      } else {
        data.ocpp_transaction_id = fallbackId;
      }
    }

    console.log(`  ✓ Session created: transaction ${data.ocpp_transaction_id}`);
    return data;
  }

  /**
   * Update charging session with live meter values (kWh, already converted)
   */
  async updateSessionMeter(transactionId, kWh) {
    if (!transactionId) return false;

    const { error } = await this.supabase
      .from('charging_sessions')
      .update({ meter_stop_kwh: kWh })
      .eq('ocpp_transaction_id', transactionId);

    if (error) {
      console.error(`Error updating meter for transaction ${transactionId}:`, error.message);
      return false;
    }

    console.log(`  ✓ Transaction ${transactionId} meter → ${kWh} kWh`);
    return true;
  }

  /**
   * Reservation check-in: a session starting for a driver whose confirmed
   * reservation on this charger covers "now" flips confirmed → active and
   * links the reservation to the session row.
   */
  async checkInReservation(sessionId, chargerId, userId) {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('reservations')
      .update({ status: 'active' })
      .eq('charger_id', chargerId)
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .lte('starts_at', now)
      .gte('ends_at', now)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error(`Error checking in reservation:`, error.message);
      return;
    }

    if (data) {
      console.log(`  ✓ Reservation ${data.id} checked in (confirmed → active)`);
      await this.supabase
        .from('charging_sessions')
        .update({ reservation_id: data.id })
        .eq('id', sessionId);
    }
  }

  /**
   * Reservation check-out: the linked reservation is completed when the
   * charging session stops (frees the slot even if the window hasn't ended).
   */
  async completeReservation(reservationId) {
    const { error } = await this.supabase
      .from('reservations')
      .update({ status: 'completed' })
      .eq('id', reservationId)
      .eq('status', 'active');

    if (error) {
      console.error(`Error completing reservation ${reservationId}:`, error.message);
      return;
    }
    console.log(`  ✓ Reservation ${reservationId} completed`);
  }

  /**
   * Complete a charging session (from OCPP StopTransaction)
   *
   * Cost = (meter_stop − meter_start) × tariff, tariff from the charger's
   * station (stations.tariff_nu_per_kwh, migration 0007). Returns the linked
   * reservation id (if any) so the caller can check the driver out.
   */
  async completeSession(transactionId, meterStopKwh, { errored = false } = {}) {
    if (!transactionId) return null;

    // Fetch the session + tariff. meter_start_kwh may be NULL (gateway was
    // restarted mid-session) — cost then falls back to 0 rather than charging
    // for the charger's lifetime meter.
    let session, fetchError;
    {
      const res = await this.supabase
        .from('charging_sessions')
        .select('id, meter_start_kwh, reservation_id, charger:chargers(id, station:stations(tariff_nu_per_kwh))')
        .eq('ocpp_transaction_id', transactionId)
        .maybeSingle();
      session = res.data;
      fetchError = res.error;
    }

    if (fetchError && fetchError.message.includes('tariff_nu_per_kwh')) {
      // Pre-0007 database: retry without the tariff embed
      this.warnLegacySchemaOnce(fetchError);
      const res = await this.supabase
        .from('charging_sessions')
        .select('id, meter_start_kwh, reservation_id')
        .eq('ocpp_transaction_id', transactionId)
        .maybeSingle();
      session = res.data;
      fetchError = res.error;
    }

    if (fetchError) {
      console.error(`Error fetching transaction ${transactionId}:`, fetchError.message);
      return null;
    }
    if (!session) {
      console.error(`Cannot complete: transaction ${transactionId} not found`);
      return null;
    }

    const startKwh = Number(session.meter_start_kwh ?? NaN);
    const tariff = Number(
      session.charger?.station?.tariff_nu_per_kwh ?? config.tariffFallbackNu,
    ) || config.tariffFallbackNu;
    const deliveredKwh = Number.isFinite(startKwh)
      ? Math.max(0, meterStopKwh - startKwh)
      : 0;
    const cost = Math.round(deliveredKwh * tariff * 100) / 100;

    const { error } = await this.supabase
      .from('charging_sessions')
      .update({
        meter_stop_kwh: meterStopKwh,
        cost_nu: cost,
        status: errored ? 'errored' : 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('ocpp_transaction_id', transactionId);

    if (error) {
      console.error(`Error completing transaction ${transactionId}:`, error.message);
      return null;
    }

    console.log(
      `  ✓ Transaction ${transactionId} ${errored ? 'errored' : 'completed'}: ` +
        `${deliveredKwh} kWh, ${cost} NU (tariff ${tariff}/kWh)`,
    );
    return session.reservation_id ?? null;
  }
}

module.exports = new SupabaseClient();
