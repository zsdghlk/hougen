const fs = require("fs");

const FILE = "dialects.json";

try {
  const data = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  
  if (!Array.isArray(data)) {
    throw new Error("dialects.json は配列である必要があります");
  }

  data.forEach((entry, idx) => {
    if (!entry.word || !entry.meaning || !entry.region) {
      throw new Error(`エラー: ${idx + 1} 行目のデータに不足があります (word, meaning, region 必須)`);
    }
  });

  console.log("✅ dialects.json のバリデーション成功");
} catch (err) {
  console.error("❌ バリデーション失敗:", err.message);
  process.exit(1);
}
