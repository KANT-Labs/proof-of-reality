import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CLOUDFLARE_WEBSOCKET_URL } from '../constants';

const { width } = Dimensions.get('window');
const qrSize = width * 0.8; // Make the QR code 80% of the screen width

export const KantickFeature = ({ isFocused, isScrolling }: { isFocused?: boolean, isScrolling?: boolean }) => {
  const [payload, setPayload] = useState<{ slot: string; sig: string } | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      ws = new WebSocket(CLOUDFLARE_WEBSOCKET_URL);

      ws.onopen = () => {
        console.log('🟢 Connected to Broadcaster!');
        setWsError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setPayload({
            slot: String(data.slot),
            sig: String(data.sig)
          });
        } catch (e) {
          console.error('Error parsing block data', e);
        }
      };
      ws.onerror = (error: any) => {
        console.log('🔴 Error:', error.message || 'WebSocket connection error');
        setWsError('Connection lost. Reconnecting...');
      };

      ws.onclose = () => {
        console.log('⭕ Disconnected. Reconnecting in 3s...');
        setWsError('Reconnecting...');
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{wsError}</Text>
        </View>
        
        <View style={styles.qrContainer}>
          {payload ? (
            <QRCode
              value={JSON.stringify(payload)}
              size={qrSize}
              color="black"
              backgroundColor="white"
            />
          ) : (
            <Text style={styles.waitingText}>Waiting for blockchain signature...</Text>
          )}
        </View>

        {payload && payload.sig && (
          <View style={styles.textContainer}>
            <Text style={styles.slotText}>Slot: {payload.slot}</Text>
            <Text style={styles.sigText} numberOfLines={2}>Sig: {payload.sig.substring(0, 15)}...{payload.sig.substring(payload.sig.length - 15)}</Text>
          </View>
        )}
        
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000', width: width, overflow: 'hidden' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorContainer: { height: 40, justifyContent: 'center', marginBottom: 20 },
  errorText: { color: '#FF5252', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  qrContainer: { 
    width: qrSize + 20, 
    height: qrSize + 20, 
    backgroundColor: '#FFFFFF', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderRadius: 16
  },
  waitingText: { color: '#666666', textAlign: 'center' },
  textContainer: { marginTop: 20, alignItems: 'center', paddingHorizontal: 20 },
  slotText: { color: '#69F0AE', fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  sigText: { color: '#AAAAAA', fontSize: 12, textAlign: 'center' }
});

export default KantickFeature;