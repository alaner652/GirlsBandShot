from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import Client

    from .models import Config, SubtitleEntry


# ── SQLite ────────────────────────────────────────────────────────────────────

class SQLiteStorage:
    def __init__(self, db_path: str = "output/subtitles.db") -> None:
        self._db_path = db_path
        self._init_db()

    def _init_db(self) -> None:
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self._db_path) as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS episodes (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    created_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE IF NOT EXISTS subtitles (
                    id TEXT PRIMARY KEY,
                    episode_id TEXT REFERENCES episodes(id),
                    frame INTEGER NOT NULL,
                    timestamp TEXT NOT NULL,
                    seconds REAL NOT NULL,
                    end_frame INTEGER,
                    end_seconds REAL,
                    text TEXT NOT NULL,
                    video_path TEXT NOT NULL,
                    confidence REAL
                );
                CREATE INDEX IF NOT EXISTS idx_subtitles_episode ON subtitles(episode_id);
                CREATE INDEX IF NOT EXISTS idx_subtitles_text    ON subtitles(text);
            """)

    def ensure_episode(self, episode: str, title: str | None = None) -> None:
        with sqlite3.connect(self._db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO episodes (id, title) VALUES (?, ?)",
                (episode, title or f"Ave Mujica EP{episode}"),
            )

    def upsert(self, entry: SubtitleEntry) -> None:
        with sqlite3.connect(self._db_path) as conn:
            conn.execute(
                """INSERT OR REPLACE INTO subtitles
                   (id, episode_id, frame, timestamp, seconds, end_frame, end_seconds,
                    text, video_path, confidence)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (entry.id, entry.episode, entry.frame, entry.timestamp,
                 entry.seconds, entry.end_frame, entry.end_seconds,
                 entry.text, entry.video_path, entry.confidence),
            )


# ── Supabase ──────────────────────────────────────────────────────────────────

class SupabaseStorage:
    def __init__(self, config: Config) -> None:
        self._config = config
        self._client: Client | None = None

    def _get_client(self) -> Client:
        if self._client is None:
            from supabase import create_client
            self._client = create_client(
                os.environ["SUPABASE_URL"],
                os.environ["SUPABASE_SERVICE_KEY"],
            )
        return self._client

    def ensure_episode(self, episode: str, title: str | None = None) -> None:
        self._get_client().table("episodes").upsert(
            {"id": episode, "title": title or f"Ave Mujica EP{episode}"}
        ).execute()

    def upsert(self, entry: SubtitleEntry) -> None:
        self._get_client().table("subtitles").upsert({
            "id": entry.id,
            "episode_id": entry.episode,
            "frame": entry.frame,
            "timestamp": entry.timestamp,
            "seconds": entry.seconds,
            "end_frame": entry.end_frame,
            "end_seconds": entry.end_seconds,
            "text": entry.text,
            "video_path": entry.video_path,
            "confidence": entry.confidence,
        }).execute()
