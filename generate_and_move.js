// node generate_and_move.js
// 目的: dialects/*.json のどれかから1件を選び、140字以内の会話風ポスト文を生成。
// 成功したら、その1件を元ファイルから削除し、posted/*.posted.json に移動保存。
// 生成した本文は標準出力に表示。

import fs from "node:fs";
import path from "node:path";

const DIALECTS_DIR = "./dialects";
const POSTED_DIR = "./posted";
const MAX_LEN = 140;
const SOFT_TARGET = 128;

const PERSONAS = [
  ["👩", "👨"], ["🧑", "🧑‍🦰"], ["👧", "👦"], ["🎓", "👩‍🏫"], ["👨‍💻", "👩‍💻"]
];
const PROMPTS = [
  "これどうする？","それ何の意味？","この言い方わかる？",
  "片付けといて？","今日の天気どう？","宿題やる？"
];
const CONNECTORS = ["👉","→","↘️","※"];
const ENDINGS = ["！","。","！","。","✨","‼️"];

const TEMPLATES = [
  `{p1}「{prompt}」{p2}「{word}やで」 {arrow} {region}弁で「{meaning}」{end}`,
  `{p1}「{prompt}」{p2}「{word}言うんよ」 {arrow} {region}の方言＝「{meaning}」{end}`,
  `{p2}「{word}って知ってる？」{p1}「なにそれ？」 {arrow} {region}弁で『{meaning}』{end}`,
  `{p1}「それ、{word}やん」{p2}「どういう意味？」 {arrow} {region}弁で『{meaning}』{end}`,
  `{p1}「{prompt}」{p2}「{word}しといて」 {arrow} {region}弁＝『{meaning}』{end}`
];

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function countChars(s){ return [...s].length; } // 絵文字対応

function squeezeToMax(text, max){
  if (countChars(text) <= max) return text;
  let t = text.replace(/\s+#\S+$/u, "");             // 末尾タグ群
  if (countChars(t) <= max) return t;
  t = t.replace(/\s*👉|\s*→|\s*↘️|\s*※/gu, " ");     // 装飾矢印
  if (countChars(t) <= max) return t.trim();
  const arr = [...t];
  return arr.slice(0, Math.max(0, max-1)).join("") + "…";
}

function buildPost({word, meaning, region}){
  const [p1,p2] = pick(PERSONAS);
  const prompt = pick(PROMPTS);
  const arrow = pick(CONNECTORS);
  const end = pick(ENDINGS);
  const tpl = pick(TEMPLATES);

  let line = tpl
    .replaceAll("{p1}", p1)
    .replaceAll("{p2}", p2)
    .replaceAll("{prompt}", prompt)
    .replaceAll("{word}", word)
    .replaceAll("{meaning}", meaning)
    .replaceAll("{region}", region)
    .replaceAll("{arrow}", arrow)
    .replaceAll("{end}", end);

  if (countChars(line) > SOFT_TARGET) line = squeezeToMax(line, SOFT_TARGET);
  if (countChars(line) > MAX_LEN)     line = squeezeToMax(line, MAX_LEN);
  return line;
}

function readJsonArray(filePath){
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function atomicWrite(filePath, dataStr){
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, dataStr);
  fs.renameSync(tmp, filePath);
}

function ensureDir(d){
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function listCandidateFiles(){
  if (!fs.existsSync(DIALECTS_DIR)) return [];
  return fs.readdirSync(DIALECTS_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => path.join(DIALECTS_DIR, f));
}

function pickFileWithItems(files){
  // 中身が1件以上あるファイルに限定
  const candidates = files
    .map(fp => ({ fp, items: readJsonArray(fp) }))
    .filter(x => x.items.length > 0);
  if (candidates.length === 0) return null;
  return pick(candidates);
}

function moveItem({srcPath, item}){
  // srcPath: dialects/kansai.json → posted/kansai.posted.json
  ensureDir(POSTED_DIR);
  const base = path.basename(srcPath, ".json");
  const postedPath = path.join(POSTED_DIR, `${base}.posted.json`);

  const postedArr = readJsonArray(postedPath);
  postedArr.push(item);
  atomicWrite(postedPath, JSON.stringify(postedArr, null, 2));
}

function removeItemFromSrc({srcPath, items, index}){
  items.splice(index, 1);
  atomicWrite(srcPath, JSON.stringify(items, null, 2));
}

function main(){
  const files = listCandidateFiles();
  if (files.length === 0){
    console.error("No source files in ./dialects");
    process.exit(1);
  }

  const picked = pickFileWithItems(files);
  if (!picked){
    console.error("All files are empty. Nothing to post.");
    process.exit(2);
  }

  const { fp: srcPath, items } = picked;
  const idx = Math.floor(Math.random() * items.length);
  const entry = items[idx];

  // バリデーション（最低限）
  if (!entry || !entry.word || !entry.meaning || !entry.region){
    // 壊れデータは捨てて次へ
    removeItemFromSrc({srcPath, items, index: idx});
    console.error("Invalid entry removed. Run again.");
    process.exit(3);
  }

  // 本文生成
  const post = buildPost(entry);

  // 1) 元から削除
  removeItemFromSrc({srcPath, items, index: idx});
  // 2) postedへ移動
  moveItem({srcPath, item: entry});

  // 生成したポストを出力（Xへコピペ／別処理へパイプ）
  console.log(post);
}

main();
