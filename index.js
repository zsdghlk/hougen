const fs = require("fs");
const { TwitterApi } = require("twitter-api-v2");

// 方言データを読み込み
const FILE = "dialects.json";

try {
  const data = JSON.parse(fs.readFileSync(FILE, "utf-8"));

  if (!Array.isArray(data)) {
    throw new Error("dialects.json は配列である必要があります");
  }

  // データ検証
  data.forEach((entry, idx) => {
    if (!entry.word || !entry.meaning || !entry.region) {
      throw new Error(`エラー: ${idx + 1} 行目に不足 (word, meaning, region 必須)`);
    }
  });

  // ランダムに1件選択
  const random = data[Math.floor(Math.random() * data.length)];
  const postText = `今日の方言👉 ${random.word}（${random.region}）：『${random.meaning}』\n\n#方言 #日本語`;

  console.log("デバッグ: 投稿文 =", postText);

  (async () => {
    try {
      // X API クライアント作成
      const client = new TwitterApi({
        appKey: process.env.X_API_KEY,
        appSecret: process.env.X_API_SECRET,
        accessToken: process.env.X_ACCESS_TOKEN,
        accessSecret: process.env.X_ACCESS_SECRET,
      });

      // 投稿実行
      const res = await client.v2.tweet(postText);
      console.log("✅ 投稿成功:", res.data);

      // 投稿したアカウント確認
      const me = await client.v2.me();
      console.log("✅ 投稿したアカウント:", me.data);

    } catch (err) {
      console.error("❌ 投稿失敗:", err);
      process.exit(1);
    }
  })();
} catch (err) {
  console.error("❌ バリデーション失敗:", err.message);
  process.exit(1);
}
