import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "sg.safebank.shield.poc",
  appName: "Verity",
  webDir: "dist",
  android: { allowMixedContent: true },
  // The API runs on your laptop. Build with VITE_API_URL=http://<laptop-LAN-IP>:8000
  server: { androidScheme: "http", cleartext: true },
};

export default config;
