import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Vibration,
} from 'react-native';
import { useAudioRecorder } from 'react-native-nitro-sound';
import RNFS from 'react-native-fs';

export const App = () => {
  // Audio setup
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(
    null,
  );

  // UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [meteringHistory, setMeteringHistory] = useState<number[]>(
    Array.from({ length: 40 }, () => -160),
  );

  // Initialize the audio recorder hook from nitro-sound
  const { startRecorder, stopRecorder } = useAudioRecorder({
    onRecord: (e) => {
      if (e.currentMetering !== undefined) {
        setMeteringHistory((prev) => {
          const safePrev = Array.isArray(prev)
            ? prev
            : Array.from({ length: 40 }, () => -160);
          return [...safePrev.slice(1), e.currentMetering!];
        });
      }
    },
  });

  // Stealth Clock State
  const latestSlot = useRef<string | null>(null);
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket Connection to Broadcaster
  useEffect(() => {
    const ws = new WebSocket(
      'wss://block-watch-broadcaster.sungho55-kim.workers.dev',
    );

    ws.onopen = () => console.log('Connected to Moment Broadcaster');

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.slot) {
          latestSlot.current = data.slot;
        }
      } catch (err) {
        console.error('Failed to parse broadcaster message', err);
      }
    };

    ws.onerror = (e) => console.error('WebSocket Error', e);

    return () => ws.close();
  }, []);

  useEffect(() => {
    const checkPermission = async () => {
      if (Platform.OS === 'android') {
        const check = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        setHasMicPermission(check);
      } else {
        // iOS handles it differently, usually auto-prompts on first use
        setHasMicPermission(true);
      }
    };
    checkPermission();
  }, []);

  const transmitPulse = () => {
    if (!latestSlot.current) return;

    const currentHash = latestSlot.current;

    // Extract first char and map to 0-15
    const firstChar = currentHash.charAt(0);
    const targetDec = firstChar.charCodeAt(0) % 16;

    // Final Bulletproof Two-Click Encoding:
    // Base Delay: 400ms (Enough time for the first click to stop ringing completely)
    // Slot Width: 200ms (Massive margin of error for Android OS jitter)
    // Formula: 400ms + (Decimal * 200ms)
    // Range: Decimal 0 = 400ms gap. Decimal 15 = 3400ms gap.
    const delayMs = 400 + targetDec * 200;

    // 1. Fire the Start Marker immediately
    Vibration.vibrate(20);

    // 2. Fire the Data Marker after the calculated delay
    setTimeout(() => {
      Vibration.vibrate(20);
    }, delayMs);
  };
  const toggleRecording = async () => {
    if (isProcessing) return;

    if (isRecording) {
      // STOP RECORDING
      setIsRecording(false);
      setIsProcessing(true);

      // Stop the transmission cycle
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
      Vibration.cancel();

      try {
        const audioPath = await stopRecorder();
        console.log('Audio saved to:', audioPath);

        if (!latestSlot.current) {
          Alert.alert(
            'Sync Error',
            'Waiting to sync with the server. Please try again in a moment.',
          );
          setIsProcessing(false);
          return;
        }

        console.log('Computing physical file hash...');
        // Clean the file:// prefix if present to ensure RNFS can read it properly
        const cleanPath = audioPath.replace(/^file:\/\//, '');
        const fileHash = await RNFS.hash(cleanPath, 'sha256');
        console.log('Hash computed:', fileHash);

        const currentSlot = latestSlot.current;

        // Send to Scribe API
        console.log('Sending to Scribe API...');
        const response = await fetch(
          'https://scribe.sungho55-kim.workers.dev',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              hash: fileHash,
            }),
          },
        );

        let responseData;
        try {
          responseData = await response.json();
        } catch (e) {
          Alert.alert(
            'Server Error',
            'The server returned an invalid response. The backend may not be fully implemented yet.',
          );
          return;
        }

        // Handle Scribe Responses and Errors
        if (!response.ok) {
          if (
            responseData.error === 'hash is required'
          ) {
            Alert.alert(
              'Request Error',
              'The app failed to generate the required cryptographic data before sending.',
            );
          } else if (responseData.error === 'Invalid wallet configuration') {
            Alert.alert(
              'Server Error',
              'The server is missing its cryptographic keys. Please contact support.',
            );
          } else {
            Alert.alert(
              'Server Error',
              responseData.error ||
                'An unknown error occurred while communicating with the server.',
            );
          }
          return;
        }

        // Success Case
        console.log('Appending receipts to audio file metadata...');
        
        // The metadata block is exactly what the server returned (including versioning)
        const metadataString = JSON.stringify(responseData);
        
        // We append a clear delimiter so the verifier knows exactly where to cut the file
        // e.g., <<KANT_RECEIPT>>{"sig":"..."}<<KANT_RECEIPT_END>>
        const trailingBlock = `\n<<KANT_RECEIPT>>${metadataString}<<KANT_RECEIPT_END>>`;
        
        await RNFS.appendFile(cleanPath, trailingBlock, 'utf8');
        console.log('Metadata successfully appended to file.');

        Alert.alert(
          'Moment Secured',
          `Successfully saved!\n\nSlot: ${responseData.slot.substring(0, 15)}...\nSig: ${responseData.sig?.substring(0, 15)}...\n\nReceipts embedded into file.`,
        );
      } catch (error) {
        Alert.alert(
          'Network Error',
          'Failed to connect to the Scribe API or process the file.',
        );
        console.error(error);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // START RECORDING
      try {
        const path = `${RNFS.DocumentDirectoryPath}/kantician_recording_${Date.now()}.wav`;
        await startRecorder(path, undefined, true);
        setIsRecording(true);
        console.log('Recording started...');

        // Wait 1 second for the audio to settle, then start the cycle
        setTimeout(() => {
          transmitPulse();

          // Repeat every 4000ms.
          // Max transmission time is 3400ms. This guarantees at least 600ms of pure silence between cycles.
          vibrationIntervalRef.current = setInterval(() => {
            transmitPulse();
          }, 4000);
        }, 1000);
      } catch (e) {
        setIsRecording(false);
        console.error('Failed to start recording', e);
        Alert.alert('Recording Error', 'Could not start the microphone.');
      }
    }
  };

  if (hasMicPermission === null)
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.loadingText}>Checking permissions...</Text>
      </SafeAreaView>
    );

  if (hasMicPermission === false)
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.loadingText}>Microphone Permission Required</Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={async () => {
              if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(
                  PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                  {
                    title: 'Microphone Permission',
                    message:
                      'KANTician needs access to your microphone to record pure audio.',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                  },
                );
                setHasMicPermission(
                  granted === PermissionsAndroid.RESULTS.GRANTED,
                );
              }
            }}
          >
            <Text style={styles.permissionText}>Grant Permissions</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>KANTician</Text>
        <Text style={styles.subtitle}>Pure Audio Recorder</Text>

        {isRecording && (
          <View style={styles.recordingContainer}>
            <Text style={styles.recordingText}>Recording...</Text>
            <View style={styles.meteringContainer}>
              {(meteringHistory || []).map((val, i) => {
                // Map dB (e.g. -80 to 0) to a visual height.
                // Using a narrower range makes it more sensitive to talking,
                // and a power curve makes quiet moments flat and loud moments tall.
                const normalized = Math.min(1, Math.max(0, val + 80) / 80);
                const curve = Math.pow(normalized, 1.5);
                // 3px minimum height (creates a perfect circle since width is 3px and borderRadius is 1.5)
                const height = 3 + curve * 117;
                return (
                  <View key={i} style={[styles.meteringBar, { height }]} />
                );
              })}
            </View>
          </View>
        )}
        {/* Loading Overlay */}
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#69F0AE" />
            <Text style={styles.processingText}>Securing...</Text>
          </View>
        )}

        {/* Capture Button */}
        <TouchableOpacity
          style={[
            styles.captureButton,
            isProcessing && styles.captureButtonDisabled,
          ]}
          onPress={toggleRecording}
          disabled={isProcessing}
        >
          <View
            style={[
              styles.captureInner,
              isRecording && styles.captureInnerRecording,
            ]}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#FFF', fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: '#AAA', fontSize: 16, marginBottom: 50 },
  recordingContainer: { alignItems: 'center', marginTop: 20 },
  recordingText: { color: '#FF5252', fontSize: 18, fontWeight: 'bold' },
  meteringContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    marginTop: 20,
    gap: 2,
    overflow: 'hidden',
  },
  meteringBar: {
    width: 3,
    backgroundColor: 'rgba(255, 82, 82, 0.8)',
    borderRadius: 1.5,
  },
  loadingText: { color: '#FFF', alignSelf: 'center', marginTop: 50 },
  permissionButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#69F0AE',
    borderRadius: 8,
  },
  permissionText: { color: '#000', fontWeight: 'bold' },
  captureButton: {
    position: 'absolute',
    bottom: 50,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: { opacity: 0.5 },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },
  captureInnerRecording: {
    width: 30,
    height: 30,
    borderRadius: 5,
    backgroundColor: '#FF5252',
  }, // Red square when recording
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#69F0AE',
    marginTop: 20,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default App;
