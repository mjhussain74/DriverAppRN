import * as Network from 'expo-network';
import { uploadProof } from './api';
import {
  getPendingProofs,
  markProofUploaded,
  incrementUploadAttempt,
  photoToBase64,
  getSyncStatus,
} from './localProofStorage';

type SyncListener = (status: { pending: number; failed: number }) => void;
const listeners = new Set<SyncListener>();
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function addSyncListener(fn: SyncListener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function notifyListeners() {
  const status = await getSyncStatus();
  listeners.forEach((fn) => fn(status));
}

export async function syncProofs(): Promise<void> {
  const net = await Network.getNetworkStateAsync();
  if (!net.isConnected || !net.isInternetReachable) return;

  const pending = await getPendingProofs();
  for (const proof of pending) {
    try {
      const photoBase64 = proof.photoUri
        ? await photoToBase64(proof.photoUri)
        : undefined;

      await uploadProof(proof.routeId, proof.stopId, {
        localProofId: proof.localId,
        signatureData: proof.signatureData,
        photoBase64,
        recipientName: proof.recipientName,
        notes: proof.notes,
      });
      await markProofUploaded(proof.localId);
    } catch {
      await incrementUploadAttempt(proof.localId);
    }
  }
  await notifyListeners();
}

export function startAutoSync(intervalMs = 30_000) {
  if (syncInterval) return;
  syncInterval = setInterval(() => syncProofs(), intervalMs);
  syncProofs(); // immediate first run
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
