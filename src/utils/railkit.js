const {
  configure,
  checkPNRStatus,
  getTrainInfo,
  trackTrain,
  getTrainHistory,
  liveAtStation,
  searchTrainBetweenStations,
  getAvailability,
  fareLookup,
} = require("railkit");

/**
 * Initialize RailKit SDK with the API key from environment.
 * Called once at server startup.
 */
function initRailKit() {
  const apiKey = process.env.RAILKIT_API_KEY;
  if (!apiKey) {
    console.warn(
      "⚠️ RAILKIT_API_KEY is not set. Please add it to your .env file or Render environment variables."
    );
  } else {
    configure(apiKey);
    console.log("[RailKit] SDK initialized ✓");
  }
}

module.exports = {
  initRailKit,
  checkPNRStatus,
  getTrainInfo,
  trackTrain,
  getTrainHistory,
  liveAtStation,
  searchTrainBetweenStations,
  getAvailability,
  fareLookup,
};
