const axios = require('axios');

const API_KEY = process.env.RAILRADAR_API_KEY || 'rg_5175748b73d94b0fa785f5ae5a112435';
const BASE_URL = 'https://api.railradar.in/v1';

function getHeaders() {
  return {
    'Authorization': `Bearer ${API_KEY}`
  };
}

async function requestRadar(path, params = {}) {
  try {
    const response = await axios.get(`${BASE_URL}${path}`, {
      headers: getHeaders(),
      params: params
    });
    return { success: true, data: response.data.data, meta: response.data.meta };
  } catch (error) {
    if (error.response && error.response.data) {
      return {
        success: false,
        message: error.response.data.error?.message || 'Rail Radar API Error',
        data: null
      };
    }
    return { success: false, message: error.message, data: null };
  }
}

function initRailKit() {
  const apiKey = process.env.RAILRADAR_API_KEY || process.env.RAILKIT_API_KEY;
  if (!apiKey) {
    console.warn("s,? RAILRADAR_API_KEY is not set. Please add it to your .env file or Render environment variables.");
  } else {
    console.log("[RailRadar] SDK initialized");
  }
}

async function checkPNRStatus(pnr) {
  return requestRadar(`/pnr/${pnr}`);
}

async function getTrainInfo(trainNo) {
  return requestRadar(`/trains/${trainNo}`);
}

async function trackTrain(trainNo, date) {
  const params = date ? { date } : {};
  return requestRadar(`/trains/${trainNo}/live`, params);
}

async function getTrainHistory(trainNo, date) {
  // Rail Radar uses the live endpoint for history if date is provided
  const params = date ? { date } : {};
  return requestRadar(`/trains/${trainNo}/live`, params);
}

async function liveAtStation(code, hours = 2) {
  return requestRadar(`/stations/${code}/live`, { hours });
}

async function searchTrainBetweenStations(from, to, date) {
  // GET /v1/trains/between/{from}/{to}
  const params = date ? { date } : {};
  return requestRadar(`/trains/between/${from}/${to}`, params);
}

async function getTrainCoaches(trainNo) {
  return requestRadar(`/trains/${trainNo}/coaches`);
}

// These endpoints are deprecated/removed as they don't exist in Rail Radar
async function getAvailability() {
  return { success: false, message: 'Availability feature is discontinued.', data: null };
}

async function fareLookup() {
  return { success: false, message: 'Fare feature is discontinued.', data: null };
}

module.exports = {
  initRailKit,
  checkPNRStatus,
  getTrainInfo,
  trackTrain,
  getTrainHistory,
  liveAtStation,
  searchTrainBetweenStations,
  getTrainCoaches,
  getAvailability,
  fareLookup,
};
