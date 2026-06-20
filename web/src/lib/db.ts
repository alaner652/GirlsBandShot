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
  return fs.readdirSync(base).filter((name) => {
    try {
      return fs.statSync(path.join(base, name)).isDirectory() &&
        fs.existsSync(path.join(base, name, "subtitles.db"));
    } catch {
      return false;
    }
  });
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
