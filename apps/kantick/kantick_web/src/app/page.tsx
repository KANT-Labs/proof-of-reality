'use client';

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CLOUDFLARE_WEBSOCKET_URL } from '../constants';
import styles from './page.module.css';

export default function Index() {
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
    <div className={styles.container}>
      <div className={styles.errorContainer}>
        {wsError && <p className={styles.errorText}>{wsError}</p>}
      </div>

      <div className={styles.qrContainer}>
        {payload ? (
          <>
            <QRCodeSVG 
              value={JSON.stringify(payload)} 
              size={400} 
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              level={"L"}
            />
            <p className={styles.slotText}>Slot: {payload.slot}</p>
          </>
        ) : (
          <p className={styles.waitingText}>Waiting for blockchain signature...</p>
        )}
      </div>

      {payload && payload.sig && (
        <div className={styles.textContainer}>
          <p className={styles.sigText}>
            Sig: {payload.sig.substring(0, 15)}...{payload.sig.substring(payload.sig.length - 15)}
          </p>
        </div>
      )}
    </div>
  );
}