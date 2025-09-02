const { TwitterApi } = require("twitter-api-v2");

(async () => {
  const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  });

  try {
    const res = await client.v2.tweet("テスト投稿 from API");
    console.log("✅ 投稿成功:", res);
  } catch (err) {
    console.error("❌ 投稿失敗:", err);
  }
})();
