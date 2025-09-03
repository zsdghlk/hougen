// index.mjs — dialects/*.json からランダムに1件選んで投稿文を生成
import fs from "node:fs";
import path from "node:path";

const DIALECTS_DIR = path.join(process.cwd(), "dialects");

function pickRandomDialect() {
  // dialects/ 以下の .json を列挙（1ファイルでもOK）
  const files = fs.readdirSync(DIALECTS_DIR).filter(f => f.endsWith(".json"));
  if (files.length === 0) {
    throw new Error("No source files in ./dialects");
  }

  // ランダムにファイルを選ぶ
  const file = path.join(DIALECTS_DIR, files[Math.floor(Math.random() * files.length)]);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No entries in ${file}`);
  }

  // レコードもランダムに1件
  return data[Math.floor(Math.random() * data.length)];
}

export function buildPost() {
  const { word, meaning, region } = pickRandomDialect();
  return `👩「この言葉わかる？」👨「${word}？」 👉 ${region}弁で『${meaning}』`;
}

// GitHub Actions では POST_BODY を優先、ローカルは自動生成
if (process.env.POST_BODY) {
  console.log(process.env.POST_BODY.trim());
} else {
  console.log(buildPost());
}
