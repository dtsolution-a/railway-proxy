require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { initRailKit } = require("./utils/railkit");
const { requestLogger } = require("./middleware/logger");
const apiRoutes = require("./routes/api");

// ─── Initialize ──────────────────────────────────────────────────────────────
initRailKit(); // throws if RAILKIT_API_KEY is missing

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(requestLogger); // JSON logs every request → logs/YYYY-MM-DD.jsonl

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Railway API Proxy",
    version: "1.0.0",
    description: "Proxy server for RailKit API with caching and JSON logging",
    endpoints: {
      pnr_status:       "GET /api/pnr/:pnr",
      train_info:       "GET /api/train/:trainNo          (cached 24h)",
      live_tracking:    "GET /api/train/:trainNo/track?date=DD-MM-YYYY",
      train_history:    "GET /api/train/:trainNo/history?date=DD-MM-YYYY  (cached 6h)",
      live_at_station:  "GET /api/station/:code/live?hours=2|4|8",
      search_trains:    "GET /api/search?from=&to=&date=  (cached 12h)",
      availability:     "GET /api/availability?trainNo=&from=&to=&date=&coach=&quota=",
      fare_lookup:      "GET /api/fare?trainNo=&from=&to=&date=&class=&quota=  (cached 6h)",
      cache_stats:      "GET /api/cache/stats",
      cache_flush:      "DELETE /api/cache",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api", apiRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[Unhandled Error]", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚂 Railway API Proxy running on port ${PORT}`);
  console.log(`   Local: http://localhost:${PORT}`);
  console.log(`   Docs:  http://localhost:${PORT}/\n`);
});
