import fs from "fs";
import { TwitterApi } from "twitter-api-v2";
import { format } from "date-fns";

// === データファイル ===
const DIALECT_FILE = "dialects.json";
const LAST_FILE = "last.json";
const LOG_FILE = "log.json";

// === APIキー（GitHub Secrets から渡す） ===
const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

// === テンプレート集 ===
const templates = [
  // 固定
  {
    text: (w, m, r) =>
      `今日の方言👉 ${w}（${r}）：『${m}』\n\n#方言 #日本語`,
  },
  // 豆知識風
  {
    text: (w, m, r) =>
      `知ってた？${r}では『${w}』って『${m}』なんだって！\n#方言紹介 #豆知識`,
  },
  // ツッコミ風
  {
    text: (w, m, r) =>
      `${r}の人「${w}」\n標準語の人「え、なにそれ？」 → 実は『${m}』\n#ことば #方言`,
  },
  // ラジオ風
  {
    text: (w, m, r) =>
      `📻 本日の方言コーナー\n『${w}』（${r}）= ${m}\n#日本語 #方言`,
  },
];

// === ランダム関数 ===
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

try {
  // 方言データ読み込み
  const dialects = JSON.parse(fs.readFileSync(DIALECT_FILE, "utf-8"));

  // 前回使用データを取得
  let last = {};
  if (fs.existsSync(LAST_FILE)) {
    last = JSON.parse(fs.readFileSync(LAST_FILE, "utf-8"));
  }

  // 重複回避: 前回と違うものを選ぶ
  let entry;
  do {
    entry = randomChoice(dialects);
  } while (entry.word === last.word);

  const { word, meaning, region } = entry;

  // ランダムテンプレート
  const tpl = randomChoice(templates);
  const postText = tpl.text(word, meaning, region);

  console.log("デバッグ: 投稿文 =", postText);

  // === 投稿 ===
  const res = await client.v2.tweet(postText);
  console.log("✅ 投稿成功:", res.data);

  // === ログ更新 ===
  fs.writeFileSync(LAST_FILE, JSON.stringify(entry, null, 2));

  let logs = [];
  if (fs.existsSync(LOG_FILE)) {
    logs = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
  }
  logs.push({
    ...entry,
    postText,
    date: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
  });
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
} catch (err) {
  console.error("❌ 投稿エラー:", err);
  process.exit(1);
}
