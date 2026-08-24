// 在 web 容器裡跑，用跟 lib/ffmpeg.ts 完全一樣的解析規則檢查每個系列。
// 用法（在 VM 的專案目錄）：docker compose exec -T web node scripts/check-media.mjs
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const base = path.resolve(process.env.DATA_BASE ?? "./data");
console.log(`DATA_BASE → ${base}\n`);

if (!fs.existsSync(base)) {
  console.log("✗ DATA_BASE 不存在。volume 沒掛上，所有系列都會壞。");
  process.exit(1);
}

const series = fs
  .readdirSync(base)
  .filter((n) => {
    try {
      return (
        fs.statSync(path.join(base, n)).isDirectory() &&
        fs.existsSync(path.join(base, n, "subtitles.db"))
      );
    } catch {
      return false;
    }
  })
  .sort();

if (series.length === 0) {
  console.log("✗ 找不到任何系列（要有 <series>/subtitles.db）。");
  process.exit(1);
}

console.log(`系列（排序後，[0] 是前端預設）: ${series.join(", ")}\n`);

let broken = 0;

for (const s of series) {
  const db = new Database(path.join(base, s, "subtitles.db"), { readonly: true });
  const rows = db
    .prepare("SELECT video_path, COUNT(*) AS n FROM subtitles GROUP BY video_path ORDER BY video_path")
    .all();
  db.close();

  const bad = [];
  let badRows = 0;
  let totalRows = 0;

  for (const { video_path, n } of rows) {
    totalRows += n;
    const resolved = path.isAbsolute(video_path)
      ? video_path
      : path.resolve(base, s, video_path);
    if (!fs.existsSync(resolved)) {
      bad.push({ video_path, resolved, n });
      badRows += n;
    }
  }

  const mark = bad.length === 0 ? "✓" : "✗";
  console.log(`${mark} ${s}  ${rows.length} 個影片 / ${totalRows} 筆字幕`);

  for (const b of bad) {
    console.log(`     缺: ${b.video_path}  (${b.n} 筆)  → ${b.resolved}`);
  }
  if (bad.length > 0) {
    broken++;
    const pct = ((badRows / totalRows) * 100).toFixed(0);
    console.log(`     此系列 ${badRows}/${totalRows} 筆（${pct}%）的圖會 500`);
  }
}

console.log(
  broken === 0
    ? "\n所有系列的 video_path 都對得到檔案 → 圖片掛掉不是路徑問題，看 df / 記憶體 / 容器 log。"
    : `\n${broken} 個系列有缺檔。相對路徑錯 → 重建該系列 DB；整個 videos/ 都缺 → ./deploy.sh data <series>`
);

// ── 實際打一次 API（--http）──────────────────────────────────────────────────
// 走容器內 localhost，繞過 Cloudflare Tunnel，用來區分「app 壞」還是「tunnel 壞」。
if (process.argv.includes("--http")) {
  const origin = process.env.SELF_ORIGIN ?? "http://localhost:3000";
  console.log(`\n實際請求（${origin}，繞過 Cloudflare）：`);

  for (const s of series) {
    const db = new Database(path.join(base, s, "subtitles.db"), { readonly: true });
    const row = db.prepare("SELECT id FROM subtitles ORDER BY RANDOM() LIMIT 1").get();
    db.close();
    if (!row) continue;

    const url = `${origin}/api/image/${encodeURIComponent(s)}/${encodeURIComponent(row.id)}`;
    const t0 = Date.now();
    try {
      const res = await fetch(url);
      const bytes = (await res.arrayBuffer()).byteLength;
      const mark = res.ok && bytes > 0 ? "✓" : "✗";
      console.log(`  ${mark} ${s}/${row.id} → HTTP ${res.status}  ${bytes}B  ${Date.now() - t0}ms`);
    } catch (err) {
      console.log(`  ✗ ${s}/${row.id} → 請求失敗: ${err.message}`);
    }
  }
}
