const NodeCache = require("node-cache");

// TTL values in seconds
const TTL = {
  TRAIN_INFO: 60 * 60 * 24,        // 24 hours — route/schedule rarely changes
  TRAIN_HISTORY: 60 * 60 * 6,      // 6 hours  — completed journey, mostly stable
  SEARCH_TRAINS: 60 * 60 * 12,     // 12 hours — timetable data
  FARE_LOOKUP: 60 * 60 * 6,        // 6 hours  — fares don't change much intraday
  // Live endpoints: PNR, trackTrain, liveAtStation, getAvailability → NO CACHE
};

const cache = new NodeCache({ useClones: false });

/**
 * Get or set a cache entry.
 * @param {string} key - Cache key
 * @param {number} ttl - TTL in seconds
 * @param {Function} fetchFn - Async function that returns the data
 * @returns {{ data: any, cached: boolean }}
 */
async function getOrSet(key, ttl, fetchFn) {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return { data: cached, cached: true };
  }
  const data = await fetchFn();
  cache.set(key, data, ttl);
  return { data, cached: false };
}

function getCacheStats() {
  return cache.getStats();
}

function flushCache() {
  cache.flushAll();
}

module.exports = { getOrSet, TTL, getCacheStats, flushCache };
