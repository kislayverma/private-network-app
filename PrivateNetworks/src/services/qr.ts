import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

export interface QRCodeData {
  type: 'identity_backup';
  publicKey: string;
  privateKey: string;
  username: string;
  timestamp: number;
}

export const generateQRData = (
  publicKey: string,
  privateKey: string,
  username: string,
): string => {
  const qrData: QRCodeData = {
    type: 'identity_backup',
    publicKey,
    privateKey,
    username,
    timestamp: Date.now(),
  };
  
  return JSON.stringify(qrData);
};

export const parseQRData = (qrString: string): QRCodeData | null => {
  try {
    const data = JSON.parse(qrString);
    if (data.type === 'identity_backup' && data.publicKey && data.privateKey && data.username) {
      return data;
    }
    return null;
  } catch (error) {
    console.error('Failed to parse QR data:', error);
    return null;
  }
};

export const QRCodePlaceholder: React.FC<{data?: string}> = ({data}) => {
  const createPattern = () => {
    if (!data) {
      return Array.from({length: 25}).map((_, i) => Math.random() > 0.5);
    }
    
    const hash = data.split('').reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) & 0xffffffff;
    }, 0);
    
    return Array.from({length: 25}).map((_, i) => (hash + i) % 3 !== 0);
  };

  const pattern = createPattern();

  return (
    <View style={styles.qrCode}>
      <View style={styles.qrCodeGrid}>
        {pattern.map((filled, i) => (
          <View
            key={i}
            style={[
              styles.qrCodePixel,
              filled && styles.qrCodePixelFilled,
            ]}
          />
        ))}
      </View>
      <Text style={styles.qrCodeLabel}>Identity Backup QR Code</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  qrCode: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  qrCodeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 150,
    height: 150,
    marginBottom: 12,
  },
  qrCodePixel: {
    width: 6,
    height: 6,
    backgroundColor: '#ffffff',
    margin: 0.3,
  },
  qrCodePixelFilled: {
    backgroundColor: '#000000',
  },
  qrCodeLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
});