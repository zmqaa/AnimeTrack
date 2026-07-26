import 'server-only';

import { getRawDb } from './db';
import { nowISO } from './date-utils';
import type { AnimeNoteEntry } from './anime-shared';

interface AnimeNoteRow {
  id: number;
  animeId: number;
  episode: number | null;
  content: string;
  notedAt: string;
  createdAt: string;
  updatedAt: string;
}

function mapAnimeNote(row: AnimeNoteRow): AnimeNoteEntry {
  return {
    id: row.id,
    animeId: row.animeId,
    episode: row.episode ?? undefined,
    content: row.content,
    notedAt: row.notedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listAnimeNotes(animeId: number): AnimeNoteEntry[] {
  const rows = getRawDb().prepare(`
    SELECT id, animeId, episode, content, notedAt, createdAt, updatedAt
    FROM anime_notes
    WHERE animeId = ?
    ORDER BY episode IS NULL DESC, notedAt DESC, id DESC
  `).all(animeId) as AnimeNoteRow[];
  return rows.map(mapAnimeNote);
}

export function listAllAnimeNotes(): AnimeNoteEntry[] {
  const rows = getRawDb().prepare(`
    SELECT id, animeId, episode, content, notedAt, createdAt, updatedAt
    FROM anime_notes
    ORDER BY animeId ASC, episode IS NULL DESC, notedAt DESC, id DESC
  `).all() as AnimeNoteRow[];
  return rows.map(mapAnimeNote);
}

export function createEpisodeNote(
  animeId: number,
  input: { episode?: number; content: string; notedAt: string },
): AnimeNoteEntry | null {
  const db = getRawDb();
  const exists = db.prepare('SELECT 1 FROM anime WHERE id = ?').get(animeId);
  if (!exists) return null;

  const now = nowISO();
  const result = db.prepare(`
    INSERT INTO anime_notes (animeId, episode, content, notedAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(animeId, input.episode ?? null, input.content, input.notedAt, now, now);
  const row = db.prepare(`
    SELECT id, animeId, episode, content, notedAt, createdAt, updatedAt
    FROM anime_notes WHERE id = ?
  `).get(Number(result.lastInsertRowid)) as AnimeNoteRow;
  return mapAnimeNote(row);
}

export function updateAnimeNote(
  animeId: number,
  noteId: number,
  input: { episode?: number; content: string; notedAt: string },
): AnimeNoteEntry | null {
  const db = getRawDb();
  const result = db.prepare(`
    UPDATE anime_notes
    SET episode = ?, content = ?, notedAt = ?, updatedAt = ?
    WHERE id = ? AND animeId = ? AND episode IS NOT NULL
  `).run(input.episode ?? null, input.content, input.notedAt, nowISO(), noteId, animeId);
  if (result.changes === 0) return null;
  const row = db.prepare(`
    SELECT id, animeId, episode, content, notedAt, createdAt, updatedAt
    FROM anime_notes WHERE id = ?
  `).get(noteId) as AnimeNoteRow;
  return mapAnimeNote(row);
}

export function deleteAnimeNote(animeId: number, noteId: number): boolean {
  const result = getRawDb().prepare(`
    DELETE FROM anime_notes
    WHERE id = ? AND animeId = ? AND episode IS NOT NULL
  `).run(noteId, animeId);
  return result.changes > 0;
}

export function replaceEpisodeNotes(
  animeId: number,
  notes: Array<{ episode: number; content: string; notedAt: string }>,
): AnimeNoteEntry[] | null {
  const db = getRawDb();
  const transaction = db.transaction(() => {
    const exists = db.prepare('SELECT 1 FROM anime WHERE id = ?').get(animeId);
    if (!exists) return null;

    db.prepare('DELETE FROM anime_notes WHERE animeId = ? AND episode IS NOT NULL').run(animeId);
    const insert = db.prepare(`
      INSERT INTO anime_notes (animeId, episode, content, notedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const now = nowISO();
    for (const note of notes) {
      insert.run(animeId, note.episode, note.content, note.notedAt, now, now);
    }
    return listAnimeNotes(animeId);
  });
  return transaction();
}
