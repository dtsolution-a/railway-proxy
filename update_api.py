import codecs, re

with codecs.open('src/routes/api.js', 'r', 'utf-8') as f:
    content = f.read()

# Add import
content = content.replace("const {", "const { getJourneysOverlay,", 1)

old_search = """  try {
    const { data, cached } = await getOrSet(
      cacheKey,
      TTL.SEARCH_TRAINS,
      () => searchTrainBetweenStations(from.toUpperCase(), to.toUpperCase(), date)
    );
    res.locals.cached = cached;
    return res.json(await deepTranslate({ success: true, cached, ...data }, req.query.lang));
  } catch (err) {"""

new_search = """  try {
    const { data, cached } = await getOrSet(
      cacheKey,
      TTL.SEARCH_TRAINS,
      () => searchTrainBetweenStations(from.toUpperCase(), to.toUpperCase(), date)
    );
    
    // Fetch live delays dynamically for accurate 'departed' marking
    try {
      const trainList = Array.isArray(data) ? data : (data && data.trains ? data.trains : []);
      if (trainList.length > 0) {
        const pairs = trainList.map(t => ({
          train: String(t.train?.number || t.train_no || ''),
          station: from.toUpperCase()
        })).filter(p => p.train !== '');
        
        if (pairs.length > 0) {
           const delayResponse = await getJourneysOverlay(pairs);
           if (delayResponse.success && delayResponse.data && delayResponse.data.delays) {
              const delayMap = {};
              delayResponse.data.delays.forEach(d => {
                 delayMap[d.train] = d.departureDelayMinutes || 0;
              });
              trainList.forEach(t => {
                 const tNum = String(t.train?.number || t.train_no || '');
                 if (delayMap[tNum] !== undefined) {
                    t.live_delay_minutes = delayMap[tNum];
                 }
              });
           }
        }
      }
    } catch(e) {
       console.error("Error fetching live delays overlay", e);
    }
    
    res.locals.cached = cached;
    return res.json(await deepTranslate({ success: true, cached, ...data }, req.query.lang));
  } catch (err) {"""

content = content.replace(old_search.replace('\n', '\r\n'), new_search)
content = content.replace(old_search, new_search)

with codecs.open('src/routes/api.js', 'w', 'utf-8') as f:
    f.write(content)
print("Updated proxy search route to attach live delays")
