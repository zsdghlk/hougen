import fs from "node:fs";
import path from "node:path";

const DIALECTS_DIR = path.join(process.cwd(), "dialects");

// dialects/ 配下からランダムに1件選ぶ
function pickRandomDialect() {
  const files = fs.readdirSync(DIALECTS_DIR).filter(f => f.endsWith(".json"));
  if (files.length === 0) {
    throw new Error("No source files in ./dialects");
  }

  const file = path.join(DIALECTS_DIR, files[Math.floor(Math.random() * files.length)]);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No entries in ${file}`);
  }

  return data[Math.floor(Math.random() * data.length)];
}

export function buildPost() {
  const item = pickRandomDialect();
  const { word, meaning, region } = item;
  return `👩「この言葉わかる？」👨「${word}？」 👉 ${region}弁で『${meaning}』`;
}

// メイン処理
if (process.env.POST_BODY) {
  console.log(process.env.POST_BODY.trim());
} else {
  console.log(buildPost());
}
