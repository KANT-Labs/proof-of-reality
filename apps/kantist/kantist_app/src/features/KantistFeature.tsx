import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, ActivityIndicator, Dimensions, NativeModules } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

const { width } = Dimensions.get('window');

export const KantistFeature = ({ isFocused, isScrolling }: { isFocused?: boolean, isScrolling?: boolean }) => {
  // Camera setup
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  
  // UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidQRPresent, setIsValidQRPresent] = useState(false);
  const qrTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      for (const code of codes) {
        if (code.value) {
          try {
            const parsed = JSON.parse(code.value);
            // Check for valid payload structure
            if (parsed.slot !== undefined && !!parsed.sig) {
              setIsValidQRPresent(true);
              if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
              qrTimeoutRef.current = setTimeout(() => setIsValidQRPresent(false), 1500);
              return;
            }
          } catch (e) {
            // Ignore parse errors (not our QR code)
          }
        }
      }
    }
  });

  const takePhoto = async () => {
    if (!camera.current || isProcessing) return;

    try {
      const photo = await camera.current.takePhoto();

      setIsProcessing(true);

      const cleanPath = photo.path.replace(/^file:\/\//, '');
      const fileHash = await NativeModules.KantistImageHasher.hashImage(cleanPath);
      
      const response = await fetch('https://scribe.sungho55-kim.workers.dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hash: fileHash
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        if (responseData.error === 'hash is required') {
          Alert.alert("Request Error", "The app failed to generate the required cryptographic data before sending.");
        } else if (responseData.error === 'Invalid wallet configuration') {
          Alert.alert("Server Error", "The Scribe server is missing its cryptographic keys. Please contact support.");
        } else if (responseData.error === 'Image purity verification failed: Latency exceeded allowed window') {
          Alert.alert(
            "Purity Verification Failed", 
            "The photo took too long to process and was rejected by the blockchain. It may have been intercepted or the network is too slow. Please try taking the photo again."
          );
        } else {
          Alert.alert("Blockchain Error", responseData.error || "An unknown error occurred while communicating with the blockchain.");
        }
        return;
      }
      
      // Encode receipt as JSON string for UserComment tag
      const receiptData = JSON.stringify({
          "KANT-transaction-slot": responseData.slot,
          "KANT-file-hash": fileHash,
          "KANT-sig": responseData.sig,
          "KANT-app": true
      });
      
      try {
        const modifiedPath = await NativeModules.KantistImageHasher.writeExif(cleanPath, receiptData);
        
        await CameraRoll.save(`file://${modifiedPath}`, { type: 'photo' });
        
        await RNFS.unlink(cleanPath).catch((e) => { console.log(e); });

        Alert.alert(
          "KANTist Secured", 
          `Successfully written to Solana & saved to gallery!\n\nSlot: ${responseData.slot.substring(0, 15)}...\nSig: ${responseData.sig.substring(0, 15)}...`
        );
      } catch (exifError) {
        console.error("Exif/Save Error:", exifError);
        Alert.alert("Save Error", "Failed to secure image metadata.");
      }

    } catch (error) {
      Alert.alert("Network Error", "Failed to connect to the Scribe API. Please check your internet connection.");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!hasPermission) return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.loadingText}>Camera Permission Required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
  
  if (device == null) return <SafeAreaView style={styles.safeArea}><Text style={styles.loadingText}>No camera device found</Text></SafeAreaView>;

  // Only render the actual camera component if this screen is fully focused AND we are not currently scrolling
  const shouldRenderCamera = isFocused && !isScrolling;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {shouldRenderCamera ? (
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={!isProcessing} 
            photo={true}
            codeScanner={codeScanner}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
        )}

        {/* QR Indicator Overlay */}
        {!isProcessing && isFocused && (
          <View style={styles.qrIndicatorContainer}>
            <Text style={[styles.qrIndicatorText, isValidQRPresent ? styles.qrIndicatorValid : styles.qrIndicatorInvalid]}>
              {isValidQRPresent ? "KANTick Code Detected" : "Align KANTick QR Code"}
            </Text>
          </View>
        )}

        {/* Loading Overlay */}
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#69F0AE" />
            <Text style={styles.processingText}>Securing on Blockchain...</Text>
          </View>
        )}

        {/* Capture Button */}
        {isFocused && (
          <TouchableOpacity 
            style={[styles.captureButton, (isProcessing || !isValidQRPresent) && styles.captureButtonDisabled]} 
            onPress={takePhoto}
            disabled={isProcessing || !isValidQRPresent}
          >
            <View style={styles.captureInner} />
          </TouchableOpacity>
        )}
        
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000', width: width, overflow: 'hidden' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFF', alignSelf: 'center', marginTop: 50 },
  permissionButton: { marginTop: 20, padding: 15, backgroundColor: '#69F0AE', borderRadius: 8 },
  permissionText: { color: '#000', fontWeight: 'bold' },
  captureButton: { position: 'absolute', bottom: 50, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255, 255, 255, 0.3)', justifyContent: 'center', alignItems: 'center' },
  captureButtonDisabled: { opacity: 0.5 },
  captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#FFF' },
  processingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  processingText: { color: '#69F0AE', marginTop: 20, fontSize: 18, fontWeight: 'bold' },
  qrIndicatorContainer: { position: 'absolute', top: 60, width: '100%', alignItems: 'center' },
  qrIndicatorText: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, fontWeight: 'bold', overflow: 'hidden' },
  qrIndicatorValid: { backgroundColor: '#69F0AE', color: '#000' },
  qrIndicatorInvalid: { backgroundColor: 'rgba(255,82,82,0.8)', color: '#FFF' },
});

export default KantistFeature;