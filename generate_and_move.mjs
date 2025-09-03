// generate_and_move.mjs
// 目的: dialects/*.json から1件選び、会話風ポスト文を生成して標準出力。
// 成功したら当該エントリを元ファイルから削除し、posted/*.posted.json に追記保存。
// さらに重複ツイート回避のため、末尾に不可視/日付サフィックスを自動付与可能。
// ------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";

const DIALECTS_DIR = "./dialects";
const POSTED_DIR   = "./posted";

// 文字数ルール（Xの上限は280。ここは従来の方針を踏襲して140）
const MAX_LEN     = 140;
const SOFT_TARGET = 128;

// 重複回避モード: 'zw'（ゼロ幅: デフォルト）| 'date'（可視の日時）| 'none'
const UNIQUE_MODE = process.env.UNIQUE_MODE ?? "zw";

// ------------------------------------------------------------
// ユーティリティ
// ------------------------------------------------------------

function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

// サロゲート/絵文字対応の長さ
function countChars(s){ return [...s].length; }

// ざっくりハッシュ（不可視長の決定などに使用）
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return Math.abs(h >>> 0);
}

// 日付サフィックス（JST基準、例: " 20250903-1730"）
function dateSuffixJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y  = jst.getUTCFullYear();
  const m  = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d  = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return ` ${y}${m}${d}-${hh}${mm}`;
}

// 不可視（ゼロ幅）サフィックス。見た目は変わらず重複回避だけ達成
function zeroWidthSuffix(seed = "") {
  const glyphs = ["\u200B", "\u200C", "\u200D"]; // ZWSP, ZWNJ, ZWJ
  const n = (hash(seed) % 5) + 1; // 1〜5文字
  let s = "";
  for (let i = 0; i < n; i++) s += glyphs[(hash(seed + ":" + i) % glyphs.length)];
  return s;
}

// 既存サフィックスを除去（連投時にサフィックスが増殖しないように）
function stripKnownSuffixes(s) {
  // ゼロ幅の連なり or " 20250903-1730" 形式を末尾から除去
  return s.replace(/[\u200B\u200C\u200D]+$/u, "").replace(/\s?\d{8}-\d{4}$/u, "");
}

// 本文をMAX_LEN以内に収める（末尾タグや矢印などから優先的に削る）
function squeezeToMax(text, max){
  if (countChars(text) <= max) return text;
  let t = text.replace(/\s+#\S+$/u, "");                 // 末尾タグ群
  if (countChars(t) <= max) return t;
  t = t.replace(/\s*(👉|→|↘️|※)/gu, " ");                // 装飾矢印
  if (countChars(t) <= max) return t.trim();
  const arr = [...t];
  return arr.slice(0, Math.max(0, max - 1)).join("") + "…";
}

// 一意化サフィックスを付与（必要なら本文をトリミングしてから付与）
function makeUnique(original) {
  if (UNIQUE_MODE === "none") return squeezeToMax(original, MAX_LEN);

  // まず既存のサフィックスを剥がして正規化
  let base = stripKnownSuffixes(original);

  // 付けるサフィックスを決定
  const seed   = base + "|" + new Date().toISOString().slice(0, 13); // 時間（時）単位で変化
  const suffix = UNIQUE_MODE === "date" ? dateSuffixJST() : zeroWidthSuffix(seed);

  // はみ出し対策：サフィックス込みでMAX_LEN以内に収める
  const room = MAX_LEN - countChars(suffix);
  if (room <= 0) {
    // 想定外だが、保険として不可視1文字だけに縮小
    return squeezeToMax(stripKnownSuffixes(base), MAX_LEN - 1) + "\u200B";
  }
  if (countChars(base) > room) {
    base = squeezeToMax(base, room);
    // squeezeToMaxは末尾に "…" を付けることがある → それも含めてOK
  }
  return base + suffix;
}

// ------------------------------------------------------------
// データ/テンプレ
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// I/O ヘルパ
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// 本文生成
// ------------------------------------------------------------

function buildPost({word, meaning, region}){
  const [p1,p2] = pick(PERSONAS);
  const prompt  = pick(PROMPTS);
  const arrow   = pick(CONNECTORS);
  const end     = pick(ENDINGS);
  const tpl     = pick(TEMPLATES);

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

// ------------------------------------------------------------
// メイン
// ------------------------------------------------------------

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
  const idx   = Math.floor(Math.random() * items.length);
  const entry = items[idx];

  // 最低限のバリデーション
  if (!entry || !entry.word || !entry.meaning || !entry.region){
    // 壊れデータは捨てて次へ
    removeItemFromSrc({srcPath, items, index: idx});
    console.error("Invalid entry removed. Run again.");
    process.exit(3);
  }

  // 本文生成 → 重複回避サフィックスを適用
  let post = buildPost(entry);
  post = makeUnique(post);

  // 1) 元から削除
  removeItemFromSrc({srcPath, items, index: idx});
  // 2) postedへ移動
  moveItem({srcPath, item: entry});

  // 生成したポストを出力
  console.log(post);
}

main();
