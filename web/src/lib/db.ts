import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dbCache = new Map<string, Database.Database>();

function dataBase(): string {
  return path.resolve(process.env.DATA_BASE ?? "./data");
}

export function getDb(series: string): Database.Database {
  let db = dbCache.get(series);
  if (!db) {
    const dbPath = path.join(dataBase(), series, "subtitles.db");
    db = new Database(dbPath, { readonly: true });
    dbCache.set(series, db);
  }
  return db;
}

export function listSeries(): string[] {
  const base = dataBase();
  if (!fs.existsSync(base)) return [];
  // 排序過才穩定：readdir 在 ext4 是 hash 順序，VM 上跟本機不一定一樣，
  // 而前端和 /api/search 都拿 [0] 當預設系列。
  return fs.readdirSync(base).filter((name) => {
    try {
      return fs.statSync(path.join(base, name)).isDirectory() &&
        fs.existsSync(path.join(base, name, "subtitles.db"));
    } catch {
      return false;
    }
  }).sort();
}

export interface SeriesMeta {
  slug: string;
  title: string;
  shortTitle?: string;
  year?: number;
  episodes?: number;
  source?: string;
  description?: string;
}

export function getSeriesMeta(slug: string): SeriesMeta {
  const metaPath = path.join(dataBase(), slug, "meta.json");
  try {
    const raw = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    return { slug, title: raw.title ?? slug, ...raw };
  } catch {
    return { slug, title: slug };
  }
}

export function listSeriesMeta(): SeriesMeta[] {
  return listSeries().map(getSeriesMeta);
}

export interface SubtitleRow {
  id: string;
  episode_id: string;
  timestamp: string;
  seconds: number;
  end_seconds: number | null;
  text: string;
  confidence: number;
  video_path: string;
}
