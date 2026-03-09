import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Route } from '../types';
import { fetchDriverRoutes, fetchRoute } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useLocationTracking } from '../hooks/useLocationTracking';
import SyncStatusBadge from '../components/SyncStatusBadge';

interface Props {
  driverId: number;
  driverName: string;
  onSelectRoute: (route: Route) => void;
  onLogout: () => void;
}

const ACTIVE_STATUSES = ['dispatched', 'active', 'assigned', 'pending'];

const STATUS_COLOR: Record<string, string> = {
  pending:    '#F59E0B',
  assigned:   '#3B82F6',
  dispatched: '#8B5CF6',
  active:     '#10B981',
  completed:  '#6B7280',
  cancelled:  '#EF4444',
};
const STATUS_LABEL: Record<string, string> = {
  pending:    'Pending',
  assigned:   'Assigned',
  dispatched: 'Dispatched',
  active:     'Active',
  completed:  'Completed',
  cancelled:  'Cancelled',
};

export default function RouteListScreen({ driverId, driverName, onSelectRoute, onLogout }: Props) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { connected, addHandler } = useSocket(driverId);
  useLocationTracking(driverId);

  const load = useCallback(async () => {
    try {
      const list = await fetchDriverRoutes(driverId);
      const detailed = await Promise.all(
        list.map((r: Route) => fetchRoute(r.id).catch(() => r)),
      );
      const sorted = detailed.sort((a, b) => {
        const order: Record<string, number> = {
          active: 0, dispatched: 1, assigned: 2, pending: 3, completed: 4, cancelled: 5,
        };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      });
      setRoutes(sorted);
    } catch (e) {
      console.error('Failed to load routes', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return addHandler((event) => {
      if (event.type === 'route-dispatched' || event.type === 'route-completed') load();
    });
  }, [addHandler, load]);

  const activeRoutes = routes.filter(r => ACTIVE_STATUSES.includes(r.status));
  const historyRoutes = routes.filter(r => !ACTIVE_STATUSES.includes(r.status));

  function renderRoute({ item }: { item: Route }) {
    const color = STATUS_COLOR[item.status] ?? '#6B7280';
    const stops = item.stops?.length ?? 0;
    const completedStops = item.stops?.filter((s) => s.status === 'completed').length ?? 0;
    const isHistory = !ACTIVE_STATUSES.includes(item.status);

    return (
      <TouchableOpacity
        style={[styles.card, isHistory && styles.cardHistory]}
        onPress={() => onSelectRoute(item)}
        activeOpacity={0.75}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.routeName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
            <Text style={[styles.badgeText, { color }]}>{STATUS_LABEL[item.status] ?? item.status}</Text>
          </View>
        </View>

        {item.startAddress ? (
          <View style={styles.row}>
            <Ionicons name="location-outline" size={14} color="#6B7280" />
            <Text style={styles.meta} numberOfLines={1}>{item.startAddress}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.row}>
            <Ionicons name="navigate-outline" size={14} color="#6B7280" />
            <Text style={styles.meta}>{stops} stop{stops !== 1 ? 's' : ''}</Text>
          </View>
          {stops > 0 && (
            <View style={styles.row}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#10B981" />
              <Text style={[styles.meta, { color: '#10B981' }]}>{completedStops}/{stops} done</Text>
            </View>
          )}
          {item.estimatedDuration != null && (
            <View style={styles.row}>
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              <Text style={styles.meta}>{Math.round(item.estimatedDuration)} min</Text>
            </View>
          )}
        </View>

        {stops > 0 && !isHistory && (
          <View style={styles.progress}>
            <View style={[styles.progressBar, { width: `${(completedStops / stops) * 100}%` as any }]} />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  const listData: any[] = [
    // Active routes header
    { key: '_active_header' },
    ...(activeRoutes.length > 0
      ? activeRoutes.map(r => ({ key: `route_${r.id}`, route: r }))
      : [{ key: '_no_active' }]),
    // History toggle
    { key: '_history_toggle' },
    // History routes (only when expanded)
    ...(showHistory
      ? historyRoutes.map(r => ({ key: `hist_${r.id}`, route: r }))
      : []),
  ];

  function renderItem({ item }: { item: any }) {
    if (item.key === '_active_header') {
      return (
        <Text style={styles.sectionLabel}>Active Routes</Text>
      );
    }
    if (item.key === '_no_active') {
      return (
        <View style={styles.emptyCard}>
          <Ionicons name="cube-outline" size={40} color="#374151" />
          <Text style={styles.emptyTitle}>No active routes</Text>
          <Text style={styles.emptyBody}>Your dispatcher will send a route when ready.</Text>
        </View>
      );
    }
    if (item.key === '_history_toggle') {
      if (historyRoutes.length === 0) return null;
      return (
        <TouchableOpacity
          style={styles.historyToggle}
          onPress={() => setShowHistory(v => !v)}
        >
          <Ionicons name="time-outline" size={16} color="#6B7280" />
          <Text style={styles.historyToggleText}>
            {showHistory ? 'Hide' : 'Show'} delivery history ({historyRoutes.length})
          </Text>
          <Ionicons
            name={showHistory ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#6B7280"
          />
        </TouchableOpacity>
      );
    }
    return renderRoute({ item: item.route });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hello, {(driverName ?? '').split(' ')[0] || 'Driver'} 👋
          </Text>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: connected ? '#10B981' : '#EF4444' }]} />
            <Text style={styles.connStatus}>{connected ? 'Live' : 'Reconnecting…'}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <SyncStatusBadge />
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={22} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#3B82F6" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={item => item.key}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#3B82F6"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111827' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#1F2937',
  },
  greeting: { fontSize: 20, fontWeight: '700', color: '#F9FAFB', marginBottom: 4 },
  connStatus: { fontSize: 12, color: '#9CA3AF', marginLeft: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoutBtn: { padding: 6 },
  list: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 10, marginTop: 4,
  },
  card: {
    backgroundColor: '#1F2937', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#374151', marginBottom: 12,
  },
  cardHistory: { opacity: 0.7 },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  routeName: { fontSize: 16, fontWeight: '700', color: '#F9FAFB', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 16, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 13, color: '#9CA3AF' },
  progress: { height: 4, backgroundColor: '#374151', borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  progressBar: { height: 4, backgroundColor: '#3B82F6', borderRadius: 2 },
  emptyCard: {
    alignItems: 'center', padding: 32, gap: 8,
    backgroundColor: '#1F2937', borderRadius: 16,
    borderWidth: 1, borderColor: '#374151', marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#6B7280' },
  emptyBody: { fontSize: 13, color: '#4B5563', textAlign: 'center' },
  historyToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: '#1F2937', borderRadius: 12,
    borderWidth: 1, borderColor: '#374151', marginBottom: 12,
  },
  historyToggleText: { flex: 1, color: '#6B7280', fontSize: 14, fontWeight: '600' },
});
