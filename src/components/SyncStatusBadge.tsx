import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addSyncListener, syncProofs } from '../services/proofSyncService';
import { getSyncStatus } from '../services/localProofStorage';

export default function SyncStatusBadge() {
  const [status, setStatus] = useState({ pending: 0, failed: 0 });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    getSyncStatus().then(setStatus);
    return addSyncListener(setStatus);
  }, []);

  async function handleManualSync() {
    setSyncing(true);
    await syncProofs();
    setSyncing(false);
  }

  if (status.pending === 0 && status.failed === 0) return null;

  const color = status.failed > 0 ? '#EF4444' : '#F59E0B';

  return (
    <TouchableOpacity style={[styles.badge, { borderColor: color }]} onPress={handleManualSync}>
      <Ionicons
        name={syncing ? 'sync' : status.failed > 0 ? 'warning-outline' : 'cloud-upload-outline'}
        size={14}
        color={color}
      />
      <Text style={[styles.text, { color }]}>
        {status.pending > 0 ? `${status.pending} pending` : `${status.failed} failed`}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    borderWidth: 1, backgroundColor: '#111827',
  },
  text: { fontSize: 11, fontWeight: '600' },
});
