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
