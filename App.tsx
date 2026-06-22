import 'react-native-gesture-handler';
import React, { useEffect, useState, useCallback } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import ErrorBoundary from './src/components/ErrorBoundary';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSession, logoutDriver, getBaseUrl, fetchDriverName, SessionUser } from './src/services/api';
import { startAutoSync } from './src/services/proofSyncService';
import LoginScreen from './src/screens/LoginScreen';
import RouteListScreen from './src/screens/RouteListScreen';
import RouteDetailScreen from './src/screens/RouteDetailScreen';
import DeliveryCompleteScreen from './src/screens/DeliveryCompleteScreen';
import type { Route, RouteStop } from './src/types';

// Keep the native splash screen visible while we load the session.
// Without this call (and the matching hideAsync() below), SDK 53+ may
// never automatically dismiss the splash screen, leaving a permanently
// blank/black screen even though the app underneath is working fine.
SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op if it was already called or unsupported on this platform
});

const queryClient = new QueryClient();

const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#111827',
    card: '#1F2937',
    text: '#F9FAFB',
    border: '#374151',
    primary: '#3B82F6',
    notification: '#EF4444',
  },
};

type AuthedUser = SessionUser & { driverName: string };

type AppScreen =
  | { name: 'loading' }
  | { name: 'login' }
  | { name: 'routes'; user: AuthedUser }
  | { name: 'detail'; route: Route; user: AuthedUser }
  | { name: 'complete'; stop: RouteStop; route: Route; user: AuthedUser };

async function resolveDriverName(user: SessionUser): Promise<AuthedUser> {
  const name = user.driverName ?? await fetchDriverName(user.driverId);
  return { ...user, driverName: name };
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>({ name: 'loading' });
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    startAutoSync();

    // Hard safety net: no matter what happens above, never let the splash
    // screen stay stuck for more than 8 seconds. This guarantees the app
    // always reaches a visible screen (even if that screen then shows an
    // error) instead of freezing on the logo forever.
    const safetyTimer = setTimeout(() => setAppIsReady(true), 8000);

    (async () => {
      try {
        const url = await getBaseUrl();
        if (!url) { setScreen({ name: 'login' }); return; }

        const sessionUser = await getSession();
        if (sessionUser?.role === 'driver') {
          const user = await resolveDriverName(sessionUser);
          setScreen({ name: 'routes', user });
        } else {
          setScreen({ name: 'login' });
        }
      } catch {
        setScreen({ name: 'login' });
      } finally {
        clearTimeout(safetyTimer);
        setAppIsReady(true);
      }
    })();

    return () => clearTimeout(safetyTimer);
  }, []);

  // Called once our first real screen has been laid out on-screen.
  // This is what actually tells the native layer to hide the splash.
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [appIsReady]);

  async function handleLoggedIn(sessionUser: SessionUser) {
    const user = await resolveDriverName(sessionUser);
    setScreen({ name: 'routes', user });
  }

  async function handleLogout() {
    try { await logoutDriver(); } catch {}
    queryClient.clear();
    setScreen({ name: 'login' });
  }

  if (!appIsReady) {
    // Still resolving session — native splash screen is still showing,
    // so nothing needs to render here yet.
    return null;
  }

  if (screen.name === 'loading') {
    return (
      <ErrorBoundary>
        <View
          style={{ flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }}
          onLayout={onLayoutRootView}
        >
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer theme={DarkTheme} independent>
          <StatusBar style="light" />

          <View style={{ flex: 1 }} onLayout={onLayoutRootView}>

          {screen.name === 'login' && (
            <LoginScreen onLoggedIn={handleLoggedIn} />
          )}

          {screen.name === 'routes' && (
            <RouteListScreen
              driverId={screen.user.driverId}
              driverName={screen.user.driverName}
              onSelectRoute={(route) =>
                setScreen({ name: 'detail', route, user: screen.user })
              }
              onLogout={handleLogout}
            />
          )}

          {screen.name === 'detail' && (
            <RouteDetailScreen
              route={screen.route}
              driverId={screen.user.driverId}
              onBack={() => setScreen({ name: 'routes', user: screen.user })}
              onSelectStop={(stop, route) =>
                setScreen({ name: 'complete', stop, route, user: screen.user })
              }
            />
          )}

          {screen.name === 'complete' && (
            <DeliveryCompleteScreen
              stop={screen.stop}
              route={screen.route}
              onBack={() =>
                setScreen({ name: 'detail', route: screen.route, user: screen.user })
              }
              onCompleted={() =>
                setScreen({ name: 'detail', route: screen.route, user: screen.user })
              }
            />
          )}

          </View>

        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
