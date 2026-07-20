const fs = require("fs");
const path = require("path");

// Ensure logs directory exists
const LOGS_DIR = path.join(process.cwd(), "logs");
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Returns the log file path for today (one file per day).
 * Format: logs/2026-07-20.json
 */
function getTodayLogPath() {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  return path.join(LOGS_DIR, `${today}.jsonl`);
}

/**
 * Append a structured log entry to today's log file.
 * @param {object} entry
 */
function writeLog(entry) {
  try {
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(getTodayLogPath(), line, "utf8");
  } catch (err) {
    console.error("[Logger] Failed to write log:", err.message);
  }
}

/**
 * Express middleware that logs every request + response as JSON.
 * Attaches logData builder to res.locals so route handlers can enrich it.
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();
  const entry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    endpoint: req.path,
    params: { ...req.params },
    query: { ...req.query },
    cached: false,
    responseTimeMs: null,
    statusCode: null,
    success: null,
    data: null,
    error: null,
  };

  // Capture res.json to intercept the response body
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    entry.responseTimeMs = Date.now() - startTime;
    entry.statusCode = res.statusCode;
    entry.success = body?.success ?? (res.statusCode < 400);
    entry.cached = res.locals.cached ?? false;
    entry.data = body;
    writeLog(entry);
    return originalJson(body);
  };

  next();
}

module.exports = { requestLogger, writeLog };
