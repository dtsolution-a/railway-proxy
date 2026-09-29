const { deepTranslate } = require('../utils/translator');
const express = require("express");
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
} = require("../utils/railradar");
const { getOrSet, TTL, getCacheStats, flushCache } = require("../middleware/cache");

// ─────────────────────────────────────────────────────────────────────────────
// Helper: wrap any railkit call with consistent error handling
// ─────────────────────────────────────────────────────────────────────────────
async function safeCall(res, fn, lang="en") { result = await fn();
    result = await deepTranslate(result, lang);
    if (result && result.success === false) {
      return res.status(400).json({
        success: false,
        message: result.message || "RailKit API returned failure",
        data: null,
      });
    }
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("[Route Error]", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
      data: null,
    });
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
    return res.status(400).json({
      success: false,
      message: "Invalid PNR. Must be exactly 10 digits.",
      data: null,
    });
  }

  return safeCall(res, () => checkPNRStatus(pnr));
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Train Information — CACHED 24h
//    GET /api/train/:trainNo
//    Params: trainNo (5-digit)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/train/:trainNo", async (req, res) => {
  const { trainNo } = req.params;

  if (!/^\d{5}$/.test(trainNo)) {
    return res.status(400).json({
      success: false,
      message: "Invalid train number. Must be exactly 5 digits.",
      data: null,
    });
  }

  try {
    const { data, cached } = await getOrSet(
      `train_info_${trainNo}`,
      TTL.TRAIN_INFO,
      () => getTrainInfo(trainNo)
    );
    res.locals.cached = cached;
    return res.json(await deepTranslate({ success: true, cached, ...data }, req.query.lang));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
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
    return res.json(await deepTranslate({ success: true, cached, ...data }, req.query.lang));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// 3. Live Tracking — LIVE (no cache)
//    GET /api/train/:trainNo/track?date=DD-MM-YYYY
// ─────────────────────────────────────────────────────────────────────────────
router.get("/train/:trainNo/track", async (req, res) => {
  const { trainNo } = req.params;
  const { date } = req.query;

  return safeCall(res, () => trackTrain(trainNo, date), req.query.lang);
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
    return res.json(await deepTranslate({ success: true, cached, ...data }, req.query.lang));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
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
    return res.status(400).json({
      success: false,
      message: "Query param 'hours' must be 2, 4, or 8.",
      data: null,
    });
  }

  return safeCall(res, () => liveAtStation(code.toUpperCase(), hours), req.query.lang);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Search Trains Between Stations — CACHED 12h
//    GET /api/search?from=NDLS&to=BCT&date=DD-MM-YYYY
// ─────────────────────────────────────────────────────────────────────────────
router.get("/search", async (req, res) => {
  const { from, to, date } = req.query;

  if (!from || !to) {
    return res.status(400).json({
      success: false,
      message: "Query params 'from' and 'to' are required (station codes).",
      data: null,
    });
  }

  const cacheKey = `search_${from.toUpperCase()}_${to.toUpperCase()}_${date || "any"}`;

  try {
    const { data, cached } = await getOrSet(
      cacheKey,
      TTL.SEARCH_TRAINS,
      () => searchTrainBetweenStations(from.toUpperCase(), to.toUpperCase(), date)
    );
    res.locals.cached = cached;
    return res.json(await deepTranslate({ success: true, cached, ...data }, req.query.lang));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
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

module.exports = router;
