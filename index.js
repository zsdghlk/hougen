const fs = require("fs");
const { format } = require("date-fns");

// --- 設定 ---
const HASHTAG_CANDIDATES = [
  "#方言 #日本語 #おもしろ",
  "#方言紹介 #日本語",
  "#方言豆知識 #日本語",
  "#日本語 #ことば #方言"
];
const DIALECTS_FILE = "dialects.json";
const RSS_FILE = "posts.xml";
const LAST_FILE = "last.json";
const LOG_FILE = "log.json";

const templates = [
  "{region}では『{word}』って言うんやで。意味は『{meaning}』！",
  "方言紹介！『{word}』＝『{meaning}』（{region}）",
  "知ってた？{region}で『{word}』は『{meaning}』って意味やで〜",
  "{region}の方言豆知識👉『{word}』＝『{meaning}』",
  "今日の方言👉 {word}（{region}）：『{meaning}』"
];

try {
  // --- JSON読み込み ---
  const dialects = JSON.parse(fs.readFileSync(DIALECTS_FILE, "utf-8"));

  // --- 前回投稿回避 ---
  let lastWord = null;
  if (fs.existsSync(LAST_FILE)) {
    try {
      lastWord = JSON.parse(fs.readFileSync(LAST_FILE, "utf-8")).word;
    } catch (e) {}
  }

  // --- ランダム抽選（直近回避） ---
  let random;
  do {
    random = dialects[Math.floor(Math.random() * dialects.length)];
  } while (random.word === lastWord && dialects.length > 1);

  // --- ランダムテンプレ & ハッシュタグ ---
  const template = templates[Math.floor(Math.random() * templates.length)];
  const hashtags = HASHTAG_CANDIDATES[Math.floor(Math.random() * HASHTAG_CANDIDATES.length)];
  const postText =
    template
      .replace("{word}", random.word)
      .replace("{meaning}", random.meaning)
      .replace("{region}", random.region)
    + "\n\n" + hashtags;

  // --- 前回保存 ---
  fs.writeFileSync(LAST_FILE, JSON.stringify({ word: random.word }));

  // --- ログ履歴に保存（最新1000件） ---
  let logs = [];
  if (fs.existsSync(LOG_FILE)) {
    logs = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
  }
  logs.unshift({ date: new Date().toISOString(), text: postText });
  if (logs.length > 1000) logs = logs.slice(0, 1000);
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));

  // --- RSS更新 ---
  let rssContent = fs.readFileSync(RSS_FILE, "utf-8");

  const dateStr = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  const safeTitle = postText.replace(/\n/g, " "); // 改行はRSSで禁止されるのでスペースに

  const newItem = `
  <item>
    <title>${safeTitle}</title>
    <link>https://x.com</link>
    <pubDate>${dateStr}</pubDate>
    <guid>${Date.now()}</guid>
  </item>
  `;

  if (/<\/channel>/.test(rssContent)) {
    rssContent = rssContent.replace(/<\/channel>/, newItem + "\n</channel>");
    fs.writeFileSync(RSS_FILE, rssContent);
    console.log("✅ RSS更新完了:", safeTitle);
  } else {
    console.error("❌ RSSファイルに </channel> が見つかりませんでした");
    process.exit(1);
  }

} catch (err) {
  console.error("❌ index.js 実行中にエラー:", err.message);
  process.exit(1);
}
