const express = require("express");
const router = express.Router();
const {
  checkPNRStatus,
  getTrainInfo,
  trackTrain,
  getTrainHistory,
  liveAtStation,
  searchTrainBetweenStations,
  getAvailability,
  fareLookup,
} = require("../utils/railkit");
const { getOrSet, TTL, getCacheStats, flushCache } = require("../middleware/cache");

// ─────────────────────────────────────────────────────────────────────────────
// Helper: wrap any railkit call with consistent error handling
// ─────────────────────────────────────────────────────────────────────────────
async function safeCall(res, fn) {
  try {
    const result = await fn();
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
    return res.json({ success: true, cached, ...data });
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

  if (!date) {
    return res.status(400).json({
      success: false,
      message: "Query param 'date' is required. Format: DD-MM-YYYY",
      data: null,
    });
  }

  return safeCall(res, () => trackTrain(trainNo, date));
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Train History — CACHED 6h
//    GET /api/train/:trainNo/history?date=DD-MM-YYYY
// ─────────────────────────────────────────────────────────────────────────────
router.get("/train/:trainNo/history", async (req, res) => {
  const { trainNo } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      message: "Query param 'date' is required. Format: DD-MM-YYYY",
      data: null,
    });
  }

  try {
    const { data, cached } = await getOrSet(
      `train_history_${trainNo}_${date}`,
      TTL.TRAIN_HISTORY,
      () => getTrainHistory(trainNo, date)
    );
    res.locals.cached = cached;
    return res.json({ success: true, cached, ...data });
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

  return safeCall(res, () => liveAtStation(code.toUpperCase(), hours));
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
    return res.json({ success: true, cached, ...data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Seat Availability — LIVE (no cache, real-time)
//    GET /api/availability?trainNo=&from=&to=&date=&coach=&quota=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/availability", async (req, res) => {
  const { trainNo, from, to, date, coach, quota } = req.query;

  if (!trainNo || !from || !to || !date || !coach || !quota) {
    return res.status(400).json({
      success: false,
      message:
        "All query params are required: trainNo, from, to, date, coach, quota",
      data: null,
    });
  }

  return safeCall(res, () =>
    getAvailability(trainNo, from.toUpperCase(), to.toUpperCase(), date, coach, quota)
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Fare Lookup — CACHED 6h
//    GET /api/fare?trainNo=&from=&to=&date=&class=&quota=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/fare", async (req, res) => {
  const { trainNo, from, to, date } = req.query;
  const travelClass = req.query.class;
  const { quota } = req.query;

  if (!trainNo || !from || !to || !date || !travelClass || !quota) {
    return res.status(400).json({
      success: false,
      message:
        "All query params are required: trainNo, from, to, date, class, quota",
      data: null,
    });
  }

  const cacheKey = `fare_${trainNo}_${from}_${to}_${date}_${travelClass}_${quota}`;

  try {
    const { data, cached } = await getOrSet(
      cacheKey,
      TTL.FARE_LOOKUP,
      () =>
        fareLookup(
          trainNo,
          from.toUpperCase(),
          to.toUpperCase(),
          date,
          travelClass,
          quota
        )
    );
    res.locals.cached = cached;
    return res.json({ success: true, cached, ...data });
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
