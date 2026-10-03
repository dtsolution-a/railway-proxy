const express = require("express");
const { localize } = require("../i18n");
const router = express.Router();
const {
  checkPNRStatus,
  getTrainInfo,
  trackTrain,
  getTrainHistory,
  liveAtStation,
  searchTrainBetweenStations,
  getTrainCoaches,
  getAvailability,
  fareLookup,
  getJourneysOverlay,
} = require("../utils/railradar");
const { getOrSet, TTL, getCacheStats, flushCache } = require("../middleware/cache");

// ─────────────────────────────────────────────────────────────────────────────
// Helper: wrap any railkit call with consistent error handling
// ─────────────────────────────────────────────────────────────────────────────
// Every response - success or error - goes through here so `?lang=hi` is
// honoured uniformly (the old code forgot it on PNR and error paths).
function send(res, req, status, body) {
  const lang = req.query.lang;
  res.set("Content-Language", String(lang || "").toLowerCase().startsWith("hi") ? "hi" : "en");
  return res.status(status).json(localize(body, lang));
}

function fail(req, res, status, message) {
  return send(res, req, status, { success: false, message, data: null });
}

async function safeCall(req, res, fn) {
  try {
    const result = await fn();
    if (result && result.success === false) {
      return fail(req, res, 400, result.message || "RailKit API returned failure");
    }
    return send(res, req, 200, { success: true, ...result });
  } catch (err) {
    console.error("[Route Error]", err.message);
    return fail(req, res, 500, err.message || "Internal server error");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PNR Status — LIVE (no cache)
//    GET /api/pnr/:pnr
//    Params: pnr (10-digit)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/pnr/:pnr", async (req, res) => {
  const { pnr } = req.params;

  if (!/^\d{10}$/.test(pnr)) {
    return fail(req, res, 400, "Invalid PNR. Must be exactly 10 digits.");
  }

  return safeCall(req, res, () => checkPNRStatus(pnr));
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Train Information — CACHED 24h
//    GET /api/train/:trainNo
//    Params: trainNo (5-digit)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/train/:trainNo", async (req, res) => {
  const { trainNo } = req.params;

  if (!/^\d{5}$/.test(trainNo)) {
    return fail(req, res, 400, "Invalid train number. Must be exactly 5 digits.");
  }

  try {
    const { data, cached } = await getOrSet(
      `train_info_${trainNo}`,
      TTL.TRAIN_INFO,
      () => getTrainInfo(trainNo)
    );
    res.locals.cached = cached;
    return send(res, req, 200, { success: true, cached, ...data });
  } catch (err) {
    return fail(req, res, 500, err.message);
  }
});

// 2b. Train Coaches
router.get('/train/:trainNo/coaches', async (req, res) => {
  const { trainNo } = req.params;
  try {
    const { data, cached } = await getOrSet(
      `train_coaches_${trainNo}`,
      TTL.TRAIN_INFO,
      () => getTrainCoaches(trainNo)
    );
    res.locals.cached = cached;
    return send(res, req, 200, { success: true, cached, ...data });
  } catch (err) {
    return fail(req, res, 500, err.message);
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// 3. Live Tracking — LIVE (no cache)
//    GET /api/train/:trainNo/track?date=DD-MM-YYYY
// ─────────────────────────────────────────────────────────────────────────────
router.get("/train/:trainNo/track", async (req, res) => {
  const { trainNo } = req.params;
  const { date } = req.query;

  return safeCall(req, res, () => trackTrain(trainNo, date));
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Train History — CACHED 6h
//    GET /api/train/:trainNo/history?date=DD-MM-YYYY
// ─────────────────────────────────────────────────────────────────────────────
router.get("/train/:trainNo/history", async (req, res) => {
  const { trainNo } = req.params;
  const { date } = req.query;

  try {
    const cacheKey = date ? `train_history_${trainNo}_${date}` : `train_history_${trainNo}_auto`;
    const { data, cached } = await getOrSet(
      cacheKey,
      TTL.TRAIN_HISTORY,
      () => getTrainHistory(trainNo, date)
    );
    res.locals.cached = cached;
    return send(res, req, 200, { success: true, cached, ...data });
  } catch (err) {
    return fail(req, res, 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Live At Station — LIVE (no cache)
//    GET /api/station/:code/live?hours=2|4|8
// ─────────────────────────────────────────────────────────────────────────────
router.get("/station/:code/live", async (req, res) => {
  const { code } = req.params;
  const hours = parseInt(req.query.hours) || 2;

  if (![2, 4, 8].includes(hours)) {
    return fail(req, res, 400, "Query param 'hours' must be 2, 4, or 8.");
  }

  return safeCall(req, res, () => liveAtStation(code.toUpperCase(), hours));
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Search Trains Between Stations — CACHED 12h
//    GET /api/search?from=NDLS&to=BCT&date=DD-MM-YYYY
// ─────────────────────────────────────────────────────────────────────────────
router.get("/search", async (req, res) => {
  const { from, to, date } = req.query;

  if (!from || !to) {
    return fail(req, res, 400, "Query params 'from' and 'to' are required (station codes).");
  }

  const cacheKey = `search_${from.toUpperCase()}_${to.toUpperCase()}_${date || "any"}`;

  try {
    const { data, cached } = await getOrSet(
      cacheKey,
      TTL.SEARCH_TRAINS,
      () => searchTrainBetweenStations(from.toUpperCase(), to.toUpperCase(), date)
    );
    
    // Fetch live delays dynamically for accurate 'departed' marking
    try {
      const trainList = Array.isArray(data) ? data : (data && data.trains ? data.trains : []);
      if (trainList.length > 0) {
        const pairs = trainList.map(t => ({
          train: String(t.train?.number || t.train_no || ''),
          station: from.toUpperCase()
        })).filter(p => p.train !== '');
        
        if (pairs.length > 0) {
           const delayResponse = await getJourneysOverlay(pairs);
           if (delayResponse.success && delayResponse.data && delayResponse.data.delays) {
              const delayMap = {};
              delayResponse.data.delays.forEach(d => {
                 delayMap[d.train] = d.departureDelayMinutes || 0;
              });
              trainList.forEach(t => {
                 const tNum = String(t.train?.number || t.train_no || '');
                 if (delayMap[tNum] !== undefined) {
                    t.live_delay_minutes = delayMap[tNum];
                 }
              });
           }
        }
      }
    } catch(e) {
       console.error("Error fetching live delays overlay", e);
    }
    
    res.locals.cached = cached;
    return send(res, req, 200, { success: true, cached, ...data });
  } catch (err) {
    return fail(req, res, 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Cache stats
//    GET /api/cache/stats
// ─────────────────────────────────────────────────────────────────────────────
router.get("/cache/stats", (req, res) => {
  res.json({ success: true, stats: getCacheStats() });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Flush cache
//    DELETE /api/cache
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/cache", (req, res) => {
  flushCache();
  res.json({ success: true, message: "Cache cleared." });
});

// =======================================================================================================
// 7. Ads Configuration (Dynamic Ad Unit IDs)
//    GET /api/ads/config
// =======================================================================================================
router.get("/ads/config", (req, res) => {
  res.json({
    success: true,
    data: {
      android: {
        banner_id: "ca-app-pub-6004247106835102/6810231133",
        native_id: "ca-app-pub-6004247106835102/8561529568"
      },
      ios: {
        banner_id: "ca-app-pub-6004247106835102/6810231133",
        native_id: "ca-app-pub-6004247106835102/8561529568"
      }
    }
  });
});

module.exports = router;
