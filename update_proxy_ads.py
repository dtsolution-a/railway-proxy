import codecs

with codecs.open('src/routes/api.js', 'r', 'utf-8') as f:
    content = f.read()

ads_config_route = """// =======================================================================================================
// 7. Ads Configuration (Dynamic Ad Unit IDs)
//    GET /api/ads/config
// =======================================================================================================
router.get("/ads/config", (req, res) => {
  res.json({
    success: true,
    data: {
      android: {
        banner_id: "ca-app-pub-6004247106835102/6810231133",
        native_id: "ca-app-pub-6004247106835102/8561529568"
      },
      ios: {
        banner_id: "ca-app-pub-6004247106835102/6810231133",
        native_id: "ca-app-pub-6004247106835102/8561529568"
      }
    }
  });
});

"""

content = content.replace("module.exports = router;", ads_config_route + "module.exports = router;")

with codecs.open('src/routes/api.js', 'w', 'utf-8') as f:
    f.write(content)
print("Added ads/config route to proxy")
