# 🚂 Railway API Proxy

Node.js proxy server wrapping the [RailKit API](https://railkit.rajivdubey.dev) with:
- ✅ **8 endpoints** covering all RailKit functions
- ⚡ **Smart caching** — stable data cached to avoid wasting API credits
- 📝 **JSON logging** — every request + full response logged to `logs/YYYY-MM-DD.jsonl`
- 🚀 **One-click Render.com deploy**

---

## Setup

```bash
# 1. Clone & install
npm install

# 2. Create .env
cp .env.example .env
# → Add your RAILKIT_API_KEY

# 3. Run locally
npm run dev
```

---

## Endpoints & Response Schemas

### `GET /` — Server Info
Returns all available routes.

---

### `GET /api/pnr/:pnr` — PNR Status
> Not cached (live data)

**Params:** `pnr` — 10-digit PNR number

**Response Schema:**
```json
{
  "success": true,
  "cached": false,
  "data": {
    "train": {
      "number": "12345",
      "name": "RAJDHANI EXP"
    },
    "journey": {
      "source": { "code": "NDLS", "name": "NEW DELHI", "date": "20-07-2026", "time": "16:55" },
      "destination": { "code": "HWH", "name": "HOWRAH JN", "date": "21-07-2026", "time": "10:00" }
    },
    "boardingStation": { "code": "NDLS", "name": "NEW DELHI" },
    "class": "3A",
    "quota": "GN",
    "chartStatus": "CHARTED",
    "passengers": [
      {
        "number": 1,
        "booked": { "berth": "UB", "coach": "B2", "seat": "32" },
        "current": { "status": "CNF", "details": "B2/32 UB" }
      }
    ]
  }
}
```

---

### `GET /api/train/:trainNo` — Train Information
> Cached 24 hours (route/schedule rarely changes)

**Params:** `trainNo` — 5-digit train number

**Response Schema:**
```json
{
  "success": true,
  "cached": true,
  "data": {
    "trainInfo": {
      "train_number": "12301",
      "train_name": "HOWRAH RAJDHANI",
      "from_station": "HWH",
      "to_station": "NDLS",
      "departure": "14:05",
      "arrival": "10:00",
      "duration": "19h 55m",
      "distance": "1450",
      "running_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    },
    "route": [
      {
        "station_code": "HWH",
        "station_name": "HOWRAH JN",
        "arrival": "--",
        "departure": "14:05",
        "halt": "--",
        "distance": "0",
        "day": 1,
        "platform": "1"
      }
    ]
  }
}
```

---

### `GET /api/train/:trainNo/track?date=DD-MM-YYYY` — Live Tracking
> Not cached (real-time position)

**Response Schema:**
```json
{
  "success": true,
  "data": {
    "trainNo": "12342",
    "trainName": "EXPRESS",
    "statusNote": "Train is running 15 minutes late",
    "currentStation": { "code": "ALD", "name": "ALLAHABAD JN" },
    "delayMinutes": 15,
    "timeline": [
      {
        "stationCode": "NDLS",
        "stationName": "NEW DELHI",
        "scheduledArrival": "16:55",
        "actualArrival": "16:55",
        "scheduledDeparture": "17:00",
        "actualDeparture": "17:10",
        "delay": 10,
        "status": "departed",
        "platform": "4"
      }
    ]
  }
}
```

---

### `GET /api/train/:trainNo/history?date=DD-MM-YYYY` — Train History
> Cached 6 hours

**Response Schema:**
```json
{
  "success": true,
  "cached": false,
  "data": {
    "trainName": "HOWRAH RAJDHANI",
    "trainNo": "12301",
    "journeyDate": "15-04-2025",
    "stations": [
      {
        "stationCode": "HWH",
        "stationName": "HOWRAH JN",
        "platform": "1",
        "arrival": { "scheduled": "--", "actual": "--", "delay": 0 },
        "departure": { "scheduled": "14:05", "actual": "14:10", "delay": 5 }
      }
    ]
  }
}
```

---

### `GET /api/station/:code/live?hours=2` — Live At Station
> Not cached (real-time)

**Query:** `hours` = 2, 4, or 8 (default 2)

**Response Schema:**
```json
{
  "success": true,
  "data": {
    "stationCode": "NDLS",
    "stationName": "NEW DELHI",
    "summary": "12 trains in next 2 hours",
    "totalTrains": 12,
    "trains": [
      {
        "trainNo": "12301",
        "trainName": "HOWRAH RAJDHANI",
        "sourceName": "NEW DELHI",
        "destName": "HOWRAH JN",
        "platform": "3",
        "arrival": { "scheduled": "14:00", "actual": "14:15", "delay": "15 min late" },
        "departure": { "scheduled": "14:05", "actual": "14:20" },
        "status": "Arriving"
      }
    ]
  }
}
```

---

### `GET /api/search?from=NDLS&to=BCT&date=DD-MM-YYYY` — Search Trains
> Cached 12 hours

**Response Schema:**
```json
{
  "success": true,
  "cached": true,
  "data": [
    {
      "train_number": "12953",
      "train_name": "AUGUST KRANTI RAJ",
      "from_station_code": "NDLS",
      "to_station_code": "BCT",
      "departure": "17:25",
      "arrival": "08:35",
      "duration": "15h 10m",
      "running_days": ["Mon", "Wed", "Fri", "Sun"],
      "available_classes": ["1A", "2A", "3A"],
      "distance": "1384"
    }
  ]
}
```

---

### `GET /api/availability?trainNo=&from=&to=&date=&coach=&quota=` — Seat Availability
> Not cached (real-time)

**Coach values:** SL, 3A, 2A, 1A, CC, EC, 2S  
**Quota values:** GN, TQ, LD, SS

**Response Schema:**
```json
{
  "success": true,
  "data": {
    "trainNo": "12496",
    "trainName": "PRATAP SF EXP",
    "from": "ASN",
    "to": "DDU",
    "date": "27-12-2025",
    "coach": "2A",
    "quota": "GN",
    "availability": [
      { "date": "27-12-2025", "status": "AVAILABLE-42", "fare": 1850 }
    ]
  }
}
```

---

### `GET /api/fare?trainNo=&from=&to=&date=&class=&quota=` — Fare Lookup
> Cached 6 hours

**Class values:** 1A, 2A, 3A, 3E, CC, EC, EA, FC, SL, 2S, VS, CH, HS, VC, VA  
**Quota values:** GN, TQ, PT, LD, DF, FT, LB, YU, DP, HP, PH, SS

**Response Schema:**
```json
{
  "success": true,
  "cached": false,
  "data": {
    "trainNo": "12313",
    "trainName": "SEALDAH RAJDHANI",
    "from": "ASN",
    "to": "NDLS",
    "distance": "1271",
    "travelClass": "3A",
    "quota": "GN",
    "baseFare": 1420,
    "reservationCharge": 40,
    "superfastCharge": 45,
    "cateringCharge": 0,
    "gst": 75,
    "dynamicFare": 0,
    "totalFare": 1580,
    "currency": "INR"
  }
}
```

---

### Admin Endpoints

| Route | Description |
|---|---|
| `GET /api/cache/stats` | View cache hit/miss stats |
| `DELETE /api/cache` | Flush all cached data |

---

## Cache Strategy

| Endpoint | Cached? | TTL |
|---|---|---|
| PNR Status | No | Live |
| Train Info | Yes | 24 hours |
| Live Tracking | No | Live |
| Train History | Yes | 6 hours |
| Live At Station | No | Live |
| Search Trains | Yes | 12 hours |
| Seat Availability | No | Live |
| Fare Lookup | Yes | 6 hours |

---

## JSON Logging

Every request is logged to `logs/YYYY-MM-DD.jsonl` (one file per day):

```json
{
  "timestamp": "2026-07-20T16:00:00.000Z",
  "method": "GET",
  "endpoint": "/api/train/12345",
  "params": { "trainNo": "12345" },
  "query": {},
  "cached": true,
  "responseTimeMs": 3,
  "statusCode": 200,
  "success": true,
  "data": { "...full response..." }
}
```

---

## Deploy to Render.com (Free Tier)

1. Push this folder to a GitHub repo (ensure `render.yaml` is present).
2. Go to [render.com](https://render.com) and sign up for a free account.
3. Click **New +** -> **Blueprint**.
4. Connect your GitHub account and select this repository.
5. Render will automatically detect `render.yaml` and configure your web service.
6. Once deployed, go to the **Environment** tab in your Render dashboard and add your API key:
   ```
   RAILKIT_API_KEY = your_key_here
   ```
7. Your service will restart and apply the API key.

Your live URL will look like: `https://railway-proxy-xxxx.onrender.com`
