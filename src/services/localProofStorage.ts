import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { LocalProof } from '../types';

let _db: SQLite.SQLiteDatabase | null = null;

async function db(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('driver_proofs.db');
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_proofs (
      localId TEXT PRIMARY KEY,
      routeId INTEGER NOT NULL,
      stopId INTEGER NOT NULL,
      signatureData TEXT,
      photoUri TEXT,
      notes TEXT,
      recipientName TEXT,
      savedAt INTEGER NOT NULL,
      uploaded INTEGER NOT NULL DEFAULT 0,
      uploadAttempts INTEGER NOT NULL DEFAULT 0
    );
  `);
  return _db;
}

export async function saveProofLocally(
  proof: Omit<LocalProof, 'savedAt' | 'uploaded' | 'uploadAttempts'>,
): Promise<LocalProof> {
  const d = await db();

  // Defensively coerce to numbers — if route/stop come from JSON they may be strings
  const routeId = Number(proof.routeId);
  const stopId = Number(proof.stopId);

  if (!routeId || !stopId) {
    throw new Error(
      `Invalid routeId (${proof.routeId}) or stopId (${proof.stopId}) — cannot save proof locally.`,
    );
  }

  const full: LocalProof = {
    ...proof,
    routeId,
    stopId,
    savedAt: Date.now(),
    uploaded: false,
    uploadAttempts: 0,
  };

  await d.runAsync(
    `INSERT OR REPLACE INTO local_proofs
      (localId, routeId, stopId, signatureData, photoUri, notes, recipientName, savedAt, uploaded, uploadAttempts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
    [
      full.localId,
      routeId,          // guaranteed integer
      stopId,           // guaranteed integer
      full.signatureData ?? null,
      full.photoUri ?? null,
      full.notes ?? null,
      full.recipientName ?? null,
      full.savedAt,
    ],
  );
  return full;
}

export async function getPendingProofs(): Promise<LocalProof[]> {
  const d = await db();
  return d.getAllAsync<LocalProof>(
    `SELECT * FROM local_proofs WHERE uploaded = 0 AND uploadAttempts < 3`,
  );
}

export async function markProofUploaded(localId: string): Promise<void> {
  const d = await db();
  await d.runAsync(
    `UPDATE local_proofs SET uploaded = 1 WHERE localId = ?`,
    [localId],
  );
}

export async function incrementUploadAttempt(localId: string): Promise<void> {
  const d = await db();
  await d.runAsync(
    `UPDATE local_proofs SET uploadAttempts = uploadAttempts + 1 WHERE localId = ?`,
    [localId],
  );
}

export async function getSyncStatus(): Promise<{ pending: number; failed: number }> {
  const d = await db();
  const pending = await d.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM local_proofs WHERE uploaded = 0 AND uploadAttempts < 3`,
  );
  const failed = await d.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM local_proofs WHERE uploaded = 0 AND uploadAttempts >= 3`,
  );
  return { pending: pending?.count ?? 0, failed: failed?.count ?? 0 };
}

export async function photoToBase64(uri: string): Promise<string | undefined> {
  if (!uri) return undefined;
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return undefined;
  }
}
