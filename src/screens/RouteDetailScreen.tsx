import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Linking, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Route, RouteStop } from '../types';
import { fetchRoute, markStopUrgent } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { decodePolyline } from '../utils/polyline';

interface Props {
  route: Route;
  driverId: number;
  onBack: () => void;
  onSelectStop: (stop: RouteStop, route: Route) => void;
}

export default function RouteDetailScreen({ route: initial, driverId, onBack, onSelectStop }: Props) {
  const [route, setRoute] = useState<Route>(initial);
  const [showMap, setShowMap] = useState(false);
  const { addHandler } = useSocket(driverId);
  const mapRef = useRef<MapView>(null);

  const refresh = useCallback(async () => {
    try {
      const updated = await fetchRoute(route.id);
      setRoute(updated);
    } catch {}
  }, [route.id]);

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    return addHandler((e) => {
      if (
        (e.type === 'stop-completed' || e.type === 'route-completed') &&
        (e as any).routeId === route.id
      ) {
        refresh();
      }
    });
  }, [addHandler, refresh]);

  const stops = route.stops?.slice().sort((a, b) => a.sequence - b.sequence) ?? [];
  const polylineCoords = route.polyline ? decodePolyline(route.polyline) : [];

  // Correctly separate the three states
  const pendingStops   = stops.filter((s) => s.status !== 'completed' && s.status !== 'cancelled');
  const completedStops = stops.filter((s) => s.status === 'completed');
  const cancelledStops = stops.filter((s) => s.status === 'cancelled');

  function openNavigationApp(stop: RouteStop) {
    const { lat, lng } = stop.delivery ?? {};
    if (!lat || !lng) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url);
  }

  async function handleMarkUrgent(stop: RouteStop) {
    try {
      await markStopUrgent(route.id, stop.id);
      await refresh();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  function renderStop({ item }: { item: RouteStop }) {
    const isCompleted = item.status === 'completed';
    const isCancelled = item.status === 'cancelled';
    const isPending   = !isCompleted && !isCancelled;
    const delivery    = item.delivery;
    const isUrgent    = item.priority && item.priority > 0;

    // Cancelled reason — strip the "CANCELLED: " prefix stored in notes
    const cancelReason = isCancelled && item.notes
      ? item.notes.replace(/^CANCELLED:\s*/i, '')
      : null;

    return (
      <TouchableOpacity
        style={[
          styles.stopCard,
          isCompleted && styles.stopCompleted,
          isCancelled && styles.stopCancelled,
        ]}
        // Only pending stops are tappable — completed and cancelled are read-only
        onPress={() => isPending ? onSelectStop(item, route) : undefined}
        disabled={!isPending}
        activeOpacity={isPending ? 0.75 : 1}
      >
        {/* Sequence / status badge */}
        <View style={[
          styles.seqBadge,
          isCompleted && styles.seqBadgeDone,
          isCancelled && styles.seqBadgeCancelled,
        ]}>
          {isCompleted ? (
            <Ionicons name="checkmark" size={16} color="#10B981" />
          ) : isCancelled ? (
            <Ionicons name="close" size={16} color="#EF4444" />
          ) : (
            <Text style={styles.seqText}>{item.sequence}</Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          {/* Customer name + badges */}
          <View style={styles.stopHeader}>
            <Text style={[
              styles.customerName,
              isCompleted && styles.textMuted,
              isCancelled && styles.textCancelled,
            ]}>
              {delivery?.customerName ?? 'Unknown Customer'}
            </Text>
            {isCancelled && (
              <View style={styles.cancelledBadge}>
                <Text style={styles.cancelledBadgeText}>CANCELLED</Text>
              </View>
            )}
            {isPending && isUrgent && (
              <View style={styles.urgentBadge}>
                <Ionicons name="flash" size={12} color="#EF4444" />
                <Text style={styles.urgentText}>URGENT</Text>
              </View>
            )}
            {item.packageScanned && isPending && (
              <View style={styles.scannedBadge}>
                <Ionicons name="barcode-outline" size={12} color="#3B82F6" />
              </View>
            )}
          </View>

          {/* Address */}
          <Text
            style={[
              styles.address,
              (isCompleted || isCancelled) && styles.textMuted,
            ]}
            numberOfLines={2}
          >
            {delivery?.addressText ?? '—'}
          </Text>

          {/* Rx info */}
          {delivery?.rxNumber && (
            <Text style={[styles.rx, isCancelled && styles.textMuted]}>
              Rx: {delivery.rxNumber}
            </Text>
          )}

          {/* Cancellation reason */}
          {isCancelled && cancelReason && (
            <Text style={styles.cancelReason} numberOfLines={2}>
              {cancelReason}
            </Text>
          )}

          {/* Delivery notes (pending only) */}
          {isPending && delivery?.notes ? (
            <Text style={styles.notes} numberOfLines={1}>{delivery.notes}</Text>
          ) : null}

          {/* Action buttons — ONLY for pending stops */}
          {isPending && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openNavigationApp(item)}>
                <Ionicons name="navigate" size={14} color="#3B82F6" />
                <Text style={styles.actionText}>Navigate</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleMarkUrgent(item)}>
                <Ionicons name="flash-outline" size={14} color="#F59E0B" />
                <Text style={[styles.actionText, { color: '#F59E0B' }]}>Urgent</Text>
              </TouchableOpacity>
              {delivery?.customerPhone && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => Linking.openURL(`tel:${delivery.customerPhone}`)}
                >
                  <Ionicons name="call-outline" size={14} color="#10B981" />
                  <Text style={[styles.actionText, { color: '#10B981' }]}>Call</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  const doneCount = completedStops.length + cancelledStops.length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#F9FAFB" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.routeName} numberOfLines={1}>{route.name}</Text>
          <Text style={styles.routeSubtitle}>
            {completedStops.length} delivered
            {cancelledStops.length > 0 ? ` · ${cancelledStops.length} cancelled` : ''}
            {' · '}{pendingStops.length} remaining
            {route.estimatedDuration ? ` · ${Math.round(route.estimatedDuration)} min` : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowMap((v) => !v)} style={styles.mapToggle}>
          <Ionicons name={showMap ? 'list-outline' : 'map-outline'} size={22} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {/* Map */}
      {showMap && stops.some((s) => s.delivery?.lat) && (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: stops[0]?.delivery?.lat ?? 40.7128,
            longitude: stops[0]?.delivery?.lng ?? -74.006,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
        >
          {polylineCoords.length > 0 && (
            <Polyline coordinates={polylineCoords} strokeColor="#3B82F6" strokeWidth={3} />
          )}
          {route.startLat && route.startLng && (
            <Marker
              coordinate={{ latitude: route.startLat, longitude: route.startLng }}
              title="Start"
              pinColor="green"
            />
          )}
          {stops.map((stop) =>
            stop.delivery?.lat && stop.delivery?.lng ? (
              <Marker
                key={stop.id}
                coordinate={{ latitude: stop.delivery.lat, longitude: stop.delivery.lng }}
                title={`#${stop.sequence} – ${stop.delivery?.customerName ?? ''}`}
                description={stop.delivery?.addressText}
                // Green = delivered, red = cancelled, blue = pending
                pinColor={
                  stop.status === 'completed' ? 'green'
                  : stop.status === 'cancelled' ? 'red'
                  : '#3B82F6'
                }
              />
            ) : null,
          )}
        </MapView>
      )}

      {/* Progress bar — completed only (not cancelled) */}
      <View style={styles.progressOuter}>
        <View
          style={[
            styles.progressInner,
            { width: stops.length ? `${(doneCount / stops.length) * 100}%` as any : '0%' },
          ]}
        />
      </View>

      {/* Stop list */}
      <FlatList
        data={stops}
        keyExtractor={(s) => String(s.id)}
        renderItem={renderStop}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111827' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937',
  },
  backBtn: { marginRight: 12, padding: 4 },
  routeName: { fontSize: 17, fontWeight: '700', color: '#F9FAFB' },
  routeSubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  mapToggle: { padding: 8 },
  map: { height: 260 },
  progressOuter: { height: 4, backgroundColor: '#1F2937' },
  progressInner: { height: 4, backgroundColor: '#3B82F6' },
  list: { padding: 16, gap: 10, paddingBottom: 40 },

  stopCard: {
    backgroundColor: '#1F2937', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderWidth: 1, borderColor: '#374151',
  },
  stopCompleted: { opacity: 0.45 },
  stopCancelled: {
    opacity: 0.6,
    borderColor: '#450A0A',
    backgroundColor: '#1C1010',
  },

  seqBadge: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#3B82F6',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  seqBadgeDone:      { backgroundColor: '#064E3B' },
  seqBadgeCancelled: { backgroundColor: '#450A0A' },
  seqText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  stopHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 },
  customerName:  { fontSize: 15, fontWeight: '700', color: '#F9FAFB' },
  textMuted:     { color: '#4B5563' },
  textCancelled: { color: '#6B7280' },

  cancelledBadge: {
    backgroundColor: '#450A0A', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#EF4444',
  },
  cancelledBadgeText: { color: '#EF4444', fontSize: 10, fontWeight: '800' },

  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#450A0A', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: '#EF4444',
  },
  urgentText: { color: '#EF4444', fontSize: 10, fontWeight: '800' },

  scannedBadge: {
    backgroundColor: '#1E3A5F', borderRadius: 4, padding: 3,
    borderWidth: 1, borderColor: '#3B82F6',
  },

  address:      { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  rx:           { fontSize: 12, color: '#6B7280', marginTop: 3 },
  notes:        { fontSize: 12, color: '#F59E0B', marginTop: 3 },
  cancelReason: { fontSize: 12, color: '#EF4444', marginTop: 4, fontStyle: 'italic', opacity: 0.8 },

  actions: { flexDirection: 'row', gap: 12, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, color: '#3B82F6', fontWeight: '600' },
});
