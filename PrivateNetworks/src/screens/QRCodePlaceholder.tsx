import { StyleSheet, View } from "react-native";

type QRCodePlaceholderProps = {
  data?: string;
};

export const QRCodePlaceholder = ({ data }: QRCodePlaceholderProps) : React.ReactNode => {
  const createPattern = () => {
    if (!data) {
      // Random 5x5 placeholder if no data
      return Array.from({ length: 25 }).map(() => Math.random() > 0.5);
    }

    // Hash the string deterministically
    const hash = data.split("").reduce((acc: number, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) & 0xffffffff;
    }, 0);

    // Generate 5x5 boolean pattern
    return Array.from({ length: 25 }).map((_, i) => (hash + i) % 3 !== 0);
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

const PIXEL_SIZE = 6;
const GRID_SIZE = 5;

const styles = StyleSheet.create({
  qrCode: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  qrCodeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: GRID_SIZE * PIXEL_SIZE,
    height: GRID_SIZE * PIXEL_SIZE,
    marginBottom: 12,
  },
  qrCodePixel: {
    width: PIXEL_SIZE,
    height: PIXEL_SIZE,
    backgroundColor: "#ffffff",
    margin: 0.3,
  },
  qrCodePixelFilled: {
    backgroundColor: "#000000",
  },
  qrCodeLabel: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
});

