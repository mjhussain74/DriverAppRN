/**
 * SignaturePad — native drawing canvas that outputs a base64 PNG.
 *
 * How it works:
 *  1. PanResponder captures finger strokes into state as arrays of {x,y} points
 *  2. SVG renders those strokes live so the driver can see what they're drawing
 *  3. On "Save", react-native-view-shot captures the SVG view as a PNG
 *  4. The PNG base64 string is passed to onSave() — exactly what the server expects
 *
 * The clearing bug fix:
 *  - PanResponder is created once via useRef and never recreated
 *  - All mutable state that the PanResponder touches goes through refs, not closures
 *  - We require ≥ 5 points before accepting a stroke (eliminates ghost taps)
 */
import React, { useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text,
  PanResponder, GestureResponderEvent, Alert, ActivityIndicator,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';

interface Props {
  onSave: (base64Png: string) => void;
  onClear: () => void;
}

interface Point { x: number; y: number }

function toD(pts: Point[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
  }
  return d;
}

const PAD_H = 220;

export default function SignaturePad({ onSave, onClear }: Props) {
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [saving, setSaving] = useState(false);

  // Refs so PanResponder closure never reads stale values
  const strokesRef = useRef<Point[][]>([]);
  const currentRef = useRef<Point[]>([]);
  const onSaveRef = useRef(onSave);
  const onClearRef = useRef(onClear);
  onSaveRef.current = onSave;
  onClearRef.current = onClear;

  // ViewShot ref — used to capture the SVG as a PNG
  const shotRef = useRef<ViewShot>(null);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (e: GestureResponderEvent) => {
        currentRef.current = [{
          x: e.nativeEvent.locationX,
          y: e.nativeEvent.locationY,
        }];
      },

      onPanResponderMove: (e: GestureResponderEvent) => {
        currentRef.current = [
          ...currentRef.current,
          { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },
        ];
        // Update display — show current stroke being drawn
        const live = [...strokesRef.current, [...currentRef.current]];
        setStrokes(live);
      },

      onPanResponderRelease: () => {
        // Only keep strokes with enough points (ignore accidental taps)
        if (currentRef.current.length >= 5) {
          strokesRef.current = [...strokesRef.current, [...currentRef.current]];
        } else {
          // Revert display to committed strokes only (remove ghost tap)
          setStrokes([...strokesRef.current]);
        }
        currentRef.current = [];
      },

      onPanResponderTerminate: () => {
        currentRef.current = [];
        setStrokes([...strokesRef.current]);
      },
    })
  ).current;

  const hasStrokes = strokesRef.current.length > 0;

  function handleClear() {
    strokesRef.current = [];
    currentRef.current = [];
    setStrokes([]);
    onClearRef.current();
  }

  async function handleSave() {
    if (!hasStrokes) return;
    setSaving(true);
    try {
      // Capture the SVG view as a white-background PNG, return as base64
      const uri = await (shotRef.current as any).capture();
      // uri is a file:// path — read it as base64
      const { readAsStringAsync, EncodingType } = require('expo-file-system');
      const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
      const dataUrl = `data:image/png;base64,${base64}`;
      onSaveRef.current(dataUrl);
    } catch (err) {
      Alert.alert('Error', 'Failed to capture signature. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      {/* ViewShot wraps the SVG so we can capture it as PNG */}
      <ViewShot
        ref={shotRef}
        options={{ format: 'png', quality: 0.9, result: 'tmpfile' }}
        style={styles.shotContainer}
      >
        {/* White background so the PNG has a proper bg, not transparent */}
        <View style={styles.canvas} {...pan.panHandlers}>
          <Svg style={StyleSheet.absoluteFill}>
            {/* White background rect inside SVG */}
            <Rect x="0" y="0" width="100%" height="100%" fill="white" />
            {strokes.map((stroke, i) =>
              stroke.length >= 2 ? (
                <Path
                  key={i}
                  d={toD(stroke)}
                  stroke="#111827"
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null
            )}
          </Svg>
          {strokes.length === 0 && (
            <Text style={styles.hint}>Sign here</Text>
          )}
        </View>
      </ViewShot>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear} disabled={saving}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, (!hasStrokes || saving) && styles.saveBtnOff]}
          onPress={handleSave}
          disabled={!hasStrokes || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveText}>Save Signature</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#374151',
    backgroundColor: '#1F2937',
  },
  shotContainer: {
    backgroundColor: 'white',
  },
  canvas: {
    height: PAD_H,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { color: '#9CA3AF', fontSize: 15 },
  btnRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    backgroundColor: '#1F2937',
  },
  clearBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderRightWidth: 1, borderRightColor: '#374151',
  },
  clearText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  saveBtn: { flex: 2, paddingVertical: 14, alignItems: 'center', backgroundColor: '#3B82F6' },
  saveBtnOff: { backgroundColor: '#1E3A5F' },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
