import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dentellejayainfinitex.dji',
  appName: 'Dentelle Jaya Infinitex',
  webDir: 'public',
  server: {
    // Arahkan ke server production Next.js agar seluruh Server Actions, Auth & Realtime jalan 100%
    url: 'https://djiprod.tech',
    // Mengizinkan komunikasi HTTP & WebSocket lokal ke ESP32 (192.168.x.x)
    cleartext: true,
    androidScheme: 'https',
    // Halaman fallback lokal saat HP membuka aplikasi tanpa koneksi internet
    errorPath: 'offline.html',
  },
  android: {
    // Memperbolehkan WebView memanggil IP lokal ESP32 tanpa diblokir kebijakan Mixed Content
    allowMixedContent: true,
  },
};

export default config;

