import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, setBaseUrl, loginDriver, SessionUser } from '../services/api';

interface Props {
  onLoggedIn: (user: SessionUser) => void;
}

export default function LoginScreen({ onLoggedIn }: Props) {
  const [serverUrl, setServerUrl] = useState('');
  const [serverConfirmed, setServerConfirmed] = useState(false);
  const [checkingServer, setCheckingServer] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    getBaseUrl().then((url) => {
      if (url) {
        setServerUrl(url);
        setServerConfirmed(true); // if we have a saved URL, skip that step
      }
    });
  }, []);

  async function handleConfirmServer() {
    if (!serverUrl.trim()) {
      Alert.alert('Error', 'Please enter the server URL');
      return;
    }
    setCheckingServer(true);
    try {
      await setBaseUrl(serverUrl.trim());
      // Light check — just verify the server responds to a known public endpoint
      const base = serverUrl.trim().replace(/\/$/, '');
      const res = await fetch(`${base}/api/auth/needs-setup`);
      if (!res.ok && res.status !== 200) throw new Error('Server did not respond');
      setServerConfirmed(true);
    } catch (e: any) {
      Alert.alert('Cannot connect', 'Make sure the URL is correct and the server is running.');
    } finally {
      setCheckingServer(false);
    }
  }

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your username and password');
      return;
    }
    setLoggingIn(true);
    try {
      const user = await loginDriver(username.trim(), password.trim());
      if (user.role !== 'driver') {
        Alert.alert('Access Denied', 'This app is for drivers only. Use the web dashboard instead.');
        return;
      }
      onLoggedIn(user);
    } catch (e: any) {
      const msg: string = e.message ?? '';
      if (msg.includes('401') || msg.includes('Invalid') || msg.includes('credentials')) {
        Alert.alert('Login Failed', 'Incorrect username or password.\n\nAsk your dispatcher to set up your driver login credentials.');
      } else if (msg.includes('403')) {
        Alert.alert('Access Denied', 'Your account does not have driver access.');
      } else {
        Alert.alert('Login Failed', msg || 'An unexpected error occurred. Check your server URL.');
      }
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Hero */}
          <View style={styles.hero}>
            <View style={styles.logoRing}>
              <Ionicons name="car" size={44} color="#3B82F6" />
            </View>
            <Text style={styles.appName}>RxRO Driver</Text>
            <Text style={styles.tagline}>Sign in to start your deliveries</Text>
          </View>

          {/* ── Step 1: Server URL ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Server</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={serverUrl}
                onChangeText={(t) => { setServerUrl(t); setServerConfirmed(false); }}
                placeholder="https://your-app.replit.dev"
                placeholderTextColor="#4B5563"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!serverConfirmed}
              />
              {serverConfirmed ? (
                <View style={styles.confirmedIcon}>
                  <Ionicons name="checkmark-circle" size={26} color="#10B981" />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.connectBtn}
                  onPress={handleConfirmServer}
                  disabled={checkingServer}
                >
                  {checkingServer
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.connectBtnText}>Connect</Text>}
                </TouchableOpacity>
              )}
            </View>
            {serverConfirmed && (
              <TouchableOpacity
                onPress={() => setServerConfirmed(false)}
                style={{ marginTop: 8 }}
              >
                <Text style={styles.changeLink}>Change server</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Step 2: Username + Password ── */}
          {serverConfirmed && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Driver Login</Text>

              {/* Username */}
              <Text style={styles.fieldLabel}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your username"
                placeholderTextColor="#4B5563"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />

              {/* Password */}
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#4B5563"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.loginBtn, loggingIn && styles.loginBtnDisabled]}
                onPress={handleLogin}
                disabled={loggingIn}
              >
                {loggingIn ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="log-in-outline" size={20} color="#fff" />
                    <Text style={styles.loginBtnText}>Sign In</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Help text */}
          {serverConfirmed && (
            <Text style={styles.hint}>
              Your username and password are set by your dispatcher in the{'\n'}
              Drivers section of the dashboard.
            </Text>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111827' },
  container: { padding: 20, paddingBottom: 52 },

  hero: { alignItems: 'center', marginTop: 28, marginBottom: 32 },
  logoRing: {
    width: 84, height: 84, borderRadius: 24, backgroundColor: '#1F2937',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    borderWidth: 1, borderColor: '#374151',
  },
  appName: { fontSize: 32, fontWeight: '800', color: '#F9FAFB', marginBottom: 6 },
  tagline: { fontSize: 15, color: '#6B7280' },

  card: {
    backgroundColor: '#1F2937', borderRadius: 16, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: '#374151',
  },
  cardTitle: {
    fontSize: 11, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13, fontWeight: '600', color: '#9CA3AF', marginBottom: 6, marginTop: 4,
  },
  input: {
    backgroundColor: '#111827', borderRadius: 10, padding: 14,
    color: '#F9FAFB', fontSize: 15, borderWidth: 1, borderColor: '#374151',
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confirmedIcon: { paddingHorizontal: 4 },
  connectBtn: {
    backgroundColor: '#3B82F6', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  connectBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  changeLink: { color: '#3B82F6', fontSize: 13 },
  eyeBtn: { padding: 10 },

  loginBtn: {
    marginTop: 8, backgroundColor: '#3B82F6', borderRadius: 12, padding: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },

  hint: {
    textAlign: 'center', color: '#4B5563', fontSize: 12,
    lineHeight: 18, marginTop: 4,
  },
});
