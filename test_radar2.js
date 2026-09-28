const axios = require('axios');
const headers = { 'Authorization': 'Bearer rg_5175748b73d94b0fa785f5ae5a112435' };
const base = 'https://api.railradar.in/v1';

async function test() {
  try {
    const res1 = await axios.get(`${base}/trains?from=NDLS&to=CSMT`, { headers }).catch(e => e.response);
    console.log('Search1:', res1.status, res1.data);
    
    const res2 = await axios.get(`${base}/search/trains-between?from=NDLS&to=CSMT`, { headers }).catch(e => e.response);
    console.log('Search2:', res2.status, res2.data);
  } catch(e) {}
}
test();
