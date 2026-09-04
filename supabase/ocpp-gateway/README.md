# EV Hub Bhutan - OCPP Gateway

OCPP 1.6 gateway that connects EV chargers to your Supabase database.

## What It Does

```
Real Charger → OCPP Gateway → Supabase → Your App
```

- Accepts WebSocket connections from OCPP chargers
- Translates OCPP messages to database records
- Writes charger status, sessions, and meter values to Supabase
- Your mobile app and admin dashboard show live data automatically

## Quick Start

### 1. Install Dependencies

```bash
cd supabase/ocpp-gateway
npm install
```

### 2. Configure

```bash
# Copy example config
cp .env.example .env

# Edit .env with your Supabase details:
# - SUPABASE_URL (from Supabase Dashboard → Settings → API)
# - SUPABASE_SERVICE_KEY (service_role key, not anon key)
```

### 3. Add a Test Charger to Database

In your **Admin Dashboard**:
1. Go to Stations → Edit a station
2. Edit a charger
3. Set **Charge Point ID (OCPP)** to: `TEST-CP-001`
4. Save

### 4. Start the Gateway

```bash
npm start
```

You should see:
```
========================================
  EV Hub Bhutan - OCPP Gateway
========================================
  OCPP Version: 1.6
  Port: 8080
  Demo Mode: ON
========================================

Gateway ready. Waiting for charger connections...
```

### 5. Run the Fake Charger Test

In a **new terminal**:

```bash
npm run test
```

This simulates a real charger:
- Connects to the gateway
- Sends status updates (Available → Occupied → Available)
- Starts a charging session
- Sends meter readings (50 → 75.5 kWh)
- Stops the session

### 6. Verify Results

| Where | What to See |
|-------|-------------|
| **Mobile App** | Charger status changes (green → red → green) |
| **Admin Dashboard** | Charger shows as "OCPP-managed" (locked) |
| **Analytics** | kWh data from the session |
| **Database** | New row in `charging_sessions` table |

## OCPP Messages Handled

| Message | Action |
|---------|--------|
| `BootNotification` | Charger announces itself |
| `Heartbeat` | Charger says "I'm alive" |
| `StatusNotification` | Charger reports status change |
| `Authorize` | User authentication |
| `StartTransaction` | Charging session begins |
| `StopTransaction` | Charging session ends |
| `MeterValues` | Periodic kWh readings |

## Status Mapping

OCPP statuses are mapped to your database:

| OCPP Status | Database Status |
|-------------|-----------------|
| Available | `available` |
| Occupied / Charging | `busy` |
| Reserved | `reserved` |
| Unavailable | `offline` |
| Faulted | `faulted` |

## Connecting Real BPC Chargers

When BPC gives you their charger details:

1. **Enter Charge Point IDs** in Admin Dashboard (Stations → Edit Charger)
2. **Update `.env`** with BPC connection details:
   ```
   CHARGERS=BPC-THIM-001:password1,BPC-THIM-002:password2
   DEMO_MODE=false
   ```
3. **Restart the gateway**
4. **BPC configures their chargers** to connect to your gateway URL

## Troubleshooting

### Gateway won't start
- Check `.env` file exists and has valid Supabase credentials
- Check port 8080 is not in use

### Fake charger can't connect
- Make sure gateway is running first
- Check `ws://localhost:8080` in fake-charger.js

### No data in database
- Verify `charge_point_id` in database matches what charger sends
- Check Supabase service key has write access
- Look at gateway console for errors

### Charger shows "not OCPP-connected"
- The `charge_point_id` field in database must match exactly
- Admin Dashboard → Stations → Edit Charger → set "Charge Point ID (OCPP)"

## File Structure

```
supabase/ocpp-gateway/
├── package.json          # Dependencies
├── .env                  # Your config (create from .env.example)
├── config.js             # Config loader
├── server.js             # WebSocket server (main entry)
├── ocpp-handler.js       # OCPP message handler
├── supabase-client.js    # Database operations
├── test/
│   └── fake-charger.js   # Fake charger for testing
└── README.md             # This file
```

## License

MIT - EV Hub Bhutan
