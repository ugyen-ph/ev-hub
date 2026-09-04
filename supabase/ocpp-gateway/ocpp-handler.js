// ============================================
// EV Hub Bhutan - OCPP Message Handler
// Parses and processes OCPP 1.6 messages
// ============================================

const supabase = require('./supabase-client');

class OcppHandler {
  constructor(connection, chargePointId) {
    this.connection = connection;
    this.chargePointId = chargePointId;
    this.currentTransactionId = null;
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
    if (!message) return this.sendError('Invalid message format');
    if (message.type !== 2) return;

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
        return this.sendResponse(message.messageId, { status: 'Accepted' });
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
      await supabase.updateChargerStatus(this.chargePointId, 'Available');
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
    console.log(`  Connector: ${connectorId}, Status: ${status}`);
    await supabase.updateChargerStatus(this.chargePointId, status);
    this.sendResponse(message.messageId, {});
  }

  async handleStartTransaction(message) {
    const { connectorId, idTag, meterStart, timestamp } = message.payload;
    console.log(`  Connector: ${connectorId}, User: ${idTag}, Meter: ${meterStart} kWh`);

    // Create session - returns numeric OCPP transaction ID
    const session = await supabase.createSession(this.chargePointId, null, meterStart);
    const transactionId = session ? session.ocppTransactionId : Date.now();
    this.currentTransactionId = transactionId;
    await supabase.updateChargerStatus(this.chargePointId, 'Occupied');

    this.sendResponse(message.messageId, {
      transactionId: transactionId,
      idTagInfo: { status: 'Accepted' },
    });
  }

  async handleStopTransaction(message) {
    const { transactionId, meterStop } = message.payload;
    console.log(`  Transaction: ${transactionId || this.currentTransactionId}, Meter: ${meterStop} kWh`);

    await supabase.completeSession(transactionId || this.currentTransactionId, meterStop);
    await supabase.updateChargerStatus(this.chargePointId, 'Available');
    this.currentTransactionId = null;

    this.sendResponse(message.messageId, {
      idTagInfo: { status: 'Accepted' },
    });
  }

  async handleMeterValues(message) {
    const { transactionId, meterValue } = message.payload;
    let meterVal = 0;
    if (meterValue && meterValue.length > 0) {
      meterVal = parseFloat(meterValue[0].sampledValue?.[0]?.value) || 0;
    }
    console.log(`  Meter: ${meterVal} kWh`);
    await supabase.updateSessionMeter(transactionId || this.currentTransactionId, meterVal);
    this.sendResponse(message.messageId, {});
  }

  async handleAuthorize(message) {
    const { idTag } = message.payload;
    console.log(`  User: ${idTag}`);
    this.sendResponse(message.messageId, { idTagInfo: { status: 'Accepted' } });
  }

  sendResponse(messageId, payload) {
    const response = [3, messageId, payload];
    this.connection.send(JSON.stringify(response));
  }

  sendError(description) {
    const error = [4, '', 'InternalError', description];
    this.connection.send(JSON.stringify(error));
  }
}

module.exports = OcppHandler;
