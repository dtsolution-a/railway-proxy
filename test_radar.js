const axios = require('axios');
const headers = { 'Authorization': 'Bearer rg_5175748b73d94b0fa785f5ae5a112435' };
const base = 'https://api.railradar.in/v1';

async function test() {
  try {
    const res1 = await axios.get(`${base}/pnr/2845662660`, { headers }).catch(e => e.response);
    console.log('PNR:', res1.status, res1.data);
    
    const res2 = await axios.get(`${base}/trains/between-stations?from=NDLS&to=CSMT`, { headers }).catch(e => e.response);
    console.log('Search:', res2.status, res2.data);
    
    const res3 = await axios.get(`${base}/trains/12952/info`, { headers }).catch(e => e.response);
    console.log('Train Info:', res3.status, res3.data);
  } catch(e) { console.error(e); }
}
test();
