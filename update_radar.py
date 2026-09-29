import codecs

with codecs.open('src/utils/railradar.js', 'r', 'utf-8') as f:
    content = f.read()

new_func = """async function requestRadarPost(path, data = {}) {
  try {
    const response = await axios.post(`${BASE_URL}${path}`, data, {
      headers: getHeaders(),
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

async function getJourneysOverlay(pairs) {
  return requestRadarPost('/journeys/overlay', { pairs });
}
"""

content = content.replace("async function checkPNRStatus", new_func + "\nasync function checkPNRStatus")
content = content.replace("module.exports = {", "module.exports = {\n  getJourneysOverlay,")

with codecs.open('src/utils/railradar.js', 'w', 'utf-8') as f:
    f.write(content)
print("Added getJourneysOverlay to railradar.js")
