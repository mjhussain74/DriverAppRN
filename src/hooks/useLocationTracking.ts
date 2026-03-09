import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { updateDriverLocation } from '../services/api';

export function useLocationTracking(
  driverId: number | null,
  onLocation?: (lat: number, lng: number) => void,
) {
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!driverId) return;

    let active = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !active) return;

      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 20, // metres
          timeInterval: 15_000,  // ms
        },
        (loc) => {
          const { latitude: lat, longitude: lng } = loc.coords;
          onLocation?.(lat, lng);
          updateDriverLocation(driverId, lat, lng).catch(() => {});
        },
      );
    })();

    return () => {
      active = false;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [driverId]);
}
