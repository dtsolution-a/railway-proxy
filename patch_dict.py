import json, codecs

with codecs.open('src/utils/hi_dictionary.json', 'r', 'utf-8') as f:
    data = json.load(f)

# Add "Ahmedabad" as a standalone entry too
data["stations"]["Ahmedabad"] = "अहमदाबाद"

with codecs.open('src/utils/hi_dictionary.json', 'w', 'utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("Fixed")
