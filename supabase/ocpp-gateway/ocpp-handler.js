// ============================================
// EV Hub Bhutan - OCPP Message Handler
// Parses and processes OCPP 1.6 messages
//
// Units: OCPP 1.6 reports meter values in Wh by default (StartTransaction
// meterStart, StopTransaction meterStop, and MeterValues sampledValue without
// an explicit unit). Everything is converted to kWh before it touches the
// database (meter_*_kwh columns).
//
// Connectors: StatusNotification is per-connector; this handler keeps the
// last known status of every connector and aggregates them into the single
// charger row (one free connector does not make a two-connector charger
// available).
// ============================================

const supabase = require('./supabase-client');

// OCPP 1.6 ChargePointStatus → our charger_status enum
const STATUS_MAP = {
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

// Which OCPP connector statuses count as "occupied-ish"
const OCCUPYING = new Set(['Occupied', 'Charging', 'Preparing', 'SuspendedEV', 'SuspendedEVSE', 'Finishing']);

// StopTransaction.reason values that mean something went wrong
const ERROR_REASONS = new Set([
  'EmergencyStop',
  'GroundFault',
  'HighVoltage',
  'OverVoltage',
  'UnderVoltage',
  'WeakSignal',
  'ImmediateReset',
  'Other',
]);

class OcppHandler {
  constructor(connection, chargePointId) {
    this.connection = connection;
    this.chargePointId = chargePointId;
    this.currentTransactionId = null;
    this.currentMeterStartKwh = null;
    // connectorId (number) -> last OCPP status reported for it
    this.connectorStatuses = new Map();
  }

  parseMessage(rawMessage) {
    try {
      const parsed = JSON.parse(rawMessage);
      return {
        type: parsed[0],
        messageId: parsed[1],
        action: parsed[2],
        payload: parsed[3] || {},
      };
    } catch (error) {
      console.error(`Error parsing message from ${this.chargePointId}:`, error.message);
      return null;
    }
  }

  async handleMessage(rawMessage) {
    const message = this.parseMessage(rawMessage);
    if (!message) {
      return this.sendCallError('', 'FramingError', 'Message is not valid OCPP JSON');
    }
    if (message.type !== 2) return; // CallResult / CallError from charger — nothing to do

    console.log(`\n[${this.chargePointId}] ${message.action}`);
    console.log(`  MessageID: ${message.messageId}`);

    switch (message.action) {
      case 'BootNotification':
        return this.handleBootNotification(message);
      case 'Heartbeat':
        return this.handleHeartbeat(message);
      case 'StatusNotification':
        return this.handleStatusNotification(message);
      case 'StartTransaction':
        return this.handleStartTransaction(message);
      case 'StopTransaction':
        return this.handleStopTransaction(message);
      case 'MeterValues':
        return this.handleMeterValues(message);
      case 'Authorize':
        return this.handleAuthorize(message);
      default:
        console.log(`  Unknown action: ${message.action}`);
        return this.sendCallError(message.messageId, 'NotImplemented', `Action ${message.action} is not implemented`);
    }
  }

  async handleBootNotification(message) {
    const { chargePointVendor, chargePointModel } = message.payload;
    console.log(`  Vendor: ${chargePointVendor}, Model: ${chargePointModel}`);

    const charger = await supabase.findCharger(this.chargePointId);
    if (!charger) {
      console.log(`  Charger ${this.chargePointId} not in database - add via Admin Dashboard`);
    } else {
      console.log(`  Charger registered in database`);
      // Charger is talking again: refresh heartbeat and treat it as available
      // (real chargers re-announce connector states right after boot).
      this.connectorStatuses.clear();
      await supabase.updateChargerStatus(this.chargePointId, 'available', {});
      await supabase.logHeartbeat(this.chargePointId);
    }

    this.sendResponse(message.messageId, {
      status: 'Accepted',
      currentTime: new Date().toISOString(),
      interval: 60,
    });
  }

  async handleHeartbeat(message) {
    await supabase.logHeartbeat(this.chargePointId);
    this.sendResponse(message.messageId, {
      currentTime: new Date().toISOString(),
    });
  }

  async handleStatusNotification(message) {
    const { connectorId, status, errorCode } = message.payload;
    console.log(`  Connector: ${connectorId}, Status: ${status}${errorCode && errorCode !== 'NoError' ? `, Error: ${errorCode}` : ''}`);

    // Remember the per-connector truth, then aggregate into the charger row
    this.connectorStatuses.set(connectorId, status);
    const aggregated = this.aggregateConnectorStatuses();

    if (aggregated) {
      await supabase.updateChargerStatus(this.chargePointId, aggregated, this.connectorStatusPayload());
      await supabase.logHeartbeat(this.chargePointId);
    }

    this.sendResponse(message.messageId, {});
  }

  /**
   * Combine every connector's OCPP status into one charger-level status.
   * Priority: faulted > occupied > reserved > all-unavailable > available.
   */
  aggregateConnectorStatuses() {
    const statuses = [...this.connectorStatuses.values()];
    if (statuses.length === 0) return null;

    const mapped = statuses.map((s) => STATUS_MAP[s] || s.toLowerCase());

    if (statuses.includes('Faulted') || mapped.includes('faulted')) return 'faulted';
    if (statuses.some((s) => OCCUPYING.has(s))) return 'busy';
    if (mapped.includes('reserved')) return 'reserved';
    if (mapped.every((s) => s === 'offline')) return 'offline';
    return 'available';
  }

  connectorStatusPayload() {
    return Object.fromEntries(
      [...this.connectorStatuses.entries()].map(([id, status]) => [String(id), status]),
    );
  }

  async handleStartTransaction(message) {
    const { connectorId, idTag, meterStart, transactionId } = message.payload;
    const meterStartKwh = whToKwh(meterStart);
    console.log(`  Connector: ${connectorId}, User: ${idTag}, Meter: ${meterStart} Wh (${meterStartKwh} kWh)`);

    // Who is charging? idTag maps to profiles.id_tag (shown on the mobile
    // Profile screen). Unknown tags still charge — they just create
    // anonymous sessions.
    const user = idTag ? await supabase.findProfileByIdTag(idTag) : null;
    if (idTag && !user) {
      console.log(`  idTag ${idTag} has no matching profile — session will be anonymous`);
    }

    // Create session; the DB assigns the numeric OCPP transaction id when the
    // charger didn't send one (unique + sequence default from migration 0007).
    const session = await supabase.createSession(this.chargePointId, transactionId ?? null, meterStartKwh, user?.id ?? null);
    const ocppTransactionId = session ? session.ocpp_transaction_id : Date.now();
    this.currentTransactionId = ocppTransactionId;
    this.currentMeterStartKwh = meterStartKwh;

    // A session starting for a driver with a confirmed reservation on this
    // charger right now = check-in (confirmed → active, linked to session).
    if (session && user) {
      await supabase.checkInReservation(session.id, session.charger_id, user.id);
    }

    // Connector truth arrives via StatusNotification, but keep the explicit
    // busy write so the map flips even if the charger never sends one.
    await supabase.updateChargerStatus(this.chargePointId, 'busy');
    await supabase.logHeartbeat(this.chargePointId);

    this.sendResponse(message.messageId, {
      transactionId: ocppTransactionId,
      idTagInfo: { status: 'Accepted' },
    });
  }

  async handleStopTransaction(message) {
    const { transactionId, meterStop, reason } = message.payload;
    const meterStopKwh = whToKwh(meterStop);
    const errored = reason ? ERROR_REASONS.has(reason) : false;
    console.log(`  Transaction: ${transactionId || this.currentTransactionId}, Meter: ${meterStop} Wh (${meterStopKwh} kWh)${reason ? `, Reason: ${reason}` : ''}`);

    const reservationId = await supabase.completeSession(
      transactionId || this.currentTransactionId,
      meterStopKwh,
      { errored },
    );

    // Charging done before the reservation window ended → release the slot
    if (reservationId) {
      await supabase.completeReservation(reservationId);
    }

    await supabase.updateChargerStatus(this.chargePointId, 'available');
    await supabase.logHeartbeat(this.chargePointId);
    this.currentTransactionId = null;
    this.currentMeterStartKwh = null;

    this.sendResponse(message.messageId, {
      idTagInfo: { status: 'Accepted' },
    });
  }

  async handleMeterValues(message) {
    const { transactionId, meterValue } = message.payload;
    const sample = meterValue?.[0]?.sampledValue?.[0];
    const kWh = sampledValueToKwh(sample);

    if (kWh === null) {
      console.log(`  Meter: no readable sample`);
      return this.sendResponse(message.messageId, {});
    }

    console.log(`  Meter: ${kWh} kWh${sample?.unit ? ` (${sample.unit})` : ' (default Wh)'}`);
    await supabase.updateSessionMeter(transactionId || this.currentTransactionId, kWh);
    this.sendResponse(message.messageId, {});
  }

  async handleAuthorize(message) {
    const { idTag } = message.payload;
    console.log(`  User: ${idTag}`);

    // Real authorization: the tag must belong to a profile. Unknown tags get
    // rejected (a charger keypad shows "Invalid card").
    const user = idTag ? await supabase.findProfileByIdTag(idTag) : null;
    if (user) {
      console.log(`  Authorized: ${user.id}`);
      this.sendResponse(message.messageId, {
        idTagInfo: { status: 'Accepted' },
      });
    } else {
      console.log(`  Rejected: unknown idTag`);
      this.sendResponse(message.messageId, {
        idTagInfo: { status: 'Invalid' },
      });
    }
  }

  sendResponse(messageId, payload) {
    const response = [3, messageId, payload];
    this.connection.send(JSON.stringify(response));
  }

  sendCallError(messageId, code, description) {
    const error = [4, messageId || '', code, description || 'InternalError', {}];
    this.connection.send(JSON.stringify(error));
  }
}

/**
 * OCPP 1.6 meter readings arrive in Wh (integer watt-hours) unless a
 * sampledValue explicitly says otherwise. Convert to kWh, rounded to 3
 * decimals (matches meter_*_kwh numeric(10,3)).
 */
function whToKwh(value) {
  const wh = Number(value);
  if (!Number.isFinite(wh)) return 0;
  return Math.round((wh / 1000) * 1000) / 1000;
}

function sampledValueToKwh(sample) {
  if (!sample) return null;
  const raw = Number(sample.value);
  if (!Number.isFinite(raw)) return null;

  // OCPP 1.6 default unit for energy samples is Wh; an explicit 'kWh' is kept
  const unit = String(sample.unit || 'Wh').toLowerCase();
  const kWh = unit === 'kwh' ? raw : whToKwh(raw);
  return Math.round(kWh * 1000) / 1000;
}

module.exports = OcppHandler;
