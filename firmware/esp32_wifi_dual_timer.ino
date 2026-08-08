/*
 * =================================================================================
 * PROYEK: ESP32 WI-FI LOKAL DUAL MACHINE DOWNTIME TIMER
 *         (WIFIMANAGER + DYNAMIC CAPTIVE PORTAL + STATIC IP + HEARTBEAT WS)
 * Deskripsi: Program ESP32 untuk memantau 2 Mesin sekaligus via Wi-Fi Lokal & WebSocket.
 *            - Mesin 1 (M1): GPIO 4 (Relay Sakelar M1)
 *            - Mesin 2 (M2): GPIO 5 (Relay Sakelar M2)
 * 
 * Aturan Trigger Sinyal Mesin:
 * - KETIKA RELAY MESIN AKTIF (LOW)  -> Kirim WebSocket {"machine":"M1","status":"START"}
 * - KETIKA RELAY MESIN OFF   (HIGH) -> Kirim WebSocket {"machine":"M1","status":"STOP"}
 * 
 * CARA PENGATURAN WI-FI DARI HP:
 * 1. Jika Wi-Fi pabrik terputus/baru, ESP32 memancarkan Hotspot: "SETUP-ESP32-TIMER"
 * 2. Connect via HP dengan Password AP: "AdminPabrik123"
 * 3. Halaman web Captive Portal akan otomatis muncul di HP (atau akses 192.168.4.1)
 * 4. Pilih SSID Wi-Fi Pabrik, masukkan password, lalu klik Save.
 * =================================================================================
 * 
 * DEPENDENSI ARDUINO LIBRARIES:
 * 1. WiFiManager by tzapu (v2.0.15+ / install via Arduino Library Manager)
 * 2. WebSockets by Markus Sattler (v2.3.0+)
 * 3. Built-in ESP32 libraries: WiFi.h, ESPmDNS.h, WebServer.h
 * =================================================================================
 */

#include <WiFi.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <WiFiManager.h> // Library WiFiManager untuk Captive Portal via HP

// --- KONFIGURASI STATIC IP DEFAULT (IP Tetap Permanen ESP32 di Pabrik) ---
IPAddress local_IP(192, 168, 2, 171);
IPAddress gateway(192, 168, 2, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(8, 8, 8, 8);
IPAddress secondaryDNS(8, 8, 4, 4);

// Domain mDNS lokal -> http://esp32-timer.local
const char* mdns_hostname = "esp32-timer";

// --- KONFIGURASI HARDWARE PIN ---
const int MESIN_1_PIN = 4;   // GPIO 4 (Input Relay Mesin 1)
const int MESIN_2_PIN = 5;   // GPIO 5 (Input Relay Mesin 2)
const int LED_M1_PIN  = 2;   // Onboard LED ESP32 (Indikator Status Sinyal M1)

// --- SERVER INSTANCES ---
WebServer httpServer(80);
WebSocketsServer webSocket = WebSocketsServer(81);
WiFiManager wm;

// --- STATE PELACAK DOWNTIME MESIN & WI-FI ---
bool m1_active = false;
bool m2_active = false;

bool wifiWasConnected = false;
unsigned long lastWiFiRetry = 0;
const unsigned long wifiRetryInterval = 5000; // Coba reconnect setiap 5 detik jika mati

// Debounce state Mesin 1
int m1_lastRawState = HIGH;
unsigned long m1_lastDebounceTime = 0;

// Debounce state Mesin 2
int m2_lastRawState = HIGH;
unsigned long m2_lastDebounceTime = 0;

const unsigned long debounceDelay = 500; // Stabilisasi sinyal 500ms

// --- HANDLER WEBSOCKET EVENT ---
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.printf("[WebSocket] Client [%u] Terputus!\n", num);
      break;

    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf("[WebSocket] Client [%u] Terhubung dari %d.%d.%d.%d\n", num, ip[0], ip[1], ip[2], ip[3]);

      // Kirimkan status fisik terkini M1 & M2 ke client yang baru terkoneksi
      String payloadM1 = String("{\"machine\":\"M1\",\"status\":\"") + (m1_active ? "START" : "STOP") + "\"}";
      String payloadM2 = String("{\"machine\":\"M2\",\"status\":\"") + (m2_active ? "START" : "STOP") + "\"}";

      webSocket.sendTXT(num, payloadM1);
      webSocket.sendTXT(num, payloadM2);
      break;
    }

    case WStype_TEXT:
      Serial.printf("[WebSocket] Pesan dari [%u]: %s\n", num, payload);
      if (strcmp((char*)payload, "PING") == 0) {
        webSocket.sendTXT(num, "PONG");
      } else if (strcmp((char*)payload, "GET_STATUS") == 0) {
        String payloadM1 = String("{\"machine\":\"M1\",\"status\":\"") + (m1_active ? "START" : "STOP") + "\"}";
        String payloadM2 = String("{\"machine\":\"M2\",\"status\":\"") + (m2_active ? "START" : "STOP") + "\"}";
        webSocket.sendTXT(num, payloadM1);
        webSocket.sendTXT(num, payloadM2);
      }
      break;

    default:
      break;
  }
}

// --- HANDLER HTTP API REST STATUS (PORT 80) ---
void handleApiStatus() {
  String json = "{\"status\":\"OK\",\"m1\":\"" + String(m1_active ? "START" : "STOP") + 
                "\", \"m2\":\"" + String(m2_active ? "START" : "STOP") + 
                "\", \"ip\":\"" + WiFi.localIP().toString() + 
                "\", \"mdns\":\"http://esp32-timer.local\"}";
  
  httpServer.sendHeader("Access-Control-Allow-Origin", "*");
  httpServer.send(200, "application/json", json);
}

void handleNotFound() {
  httpServer.sendHeader("Access-Control-Allow-Origin", "*");
  httpServer.send(404, "text/plain", "404 Not Found - Akses /api/status atau WebSocket Port 81");
}

void setup() {
  Serial.begin(115200);
  delay(500);

  // 1. Konfigurasi Input Pin dengan Pull-Up Internal
  pinMode(MESIN_1_PIN, INPUT_PULLUP);
  pinMode(MESIN_2_PIN, INPUT_PULLUP);

  pinMode(LED_M1_PIN, OUTPUT);
  digitalWrite(LED_M1_PIN, LOW);

  // Inisialisasi state awal dari fisik pin
  m1_lastRawState = digitalRead(MESIN_1_PIN);
  m1_active       = (m1_lastRawState == LOW);

  m2_lastRawState = digitalRead(MESIN_2_PIN);
  m2_active       = (m2_lastRawState == LOW);

  Serial.println("\n=============================================");
  Serial.println("  ESP32 DUAL MACHINE WI-FI TIMER STARTING... ");
  Serial.println("=============================================");

  // 2. Setup Mode Wi-Fi & Wi-Fi Manager
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.setSleep(false); // MATIKAN SLEEP MODE AGAR ANTENA SELALU NYALA REAL-TIME

  // Set Static IP untuk ESP32
  wm.setSTAStaticIPConfig(local_IP, gateway, subnet, primaryDNS, secondaryDNS);

  // Set Timeout Portal AP (3 menit / 180 detik) agar tidak menggantung jika tidak disetting
  wm.setConfigPortalTimeout(180);

  // Hubungkan ke Wi-Fi yang tersimpan. Jika belum/gagal, pancarkan Hotspot AP: "SETUP-ESP32-TIMER" Pass: "AdminPabrik123"
  bool res = wm.autoConnect("SETUP-ESP32-TIMER", "AdminPabrik123");

  if (!res) {
    Serial.println("[Wi-Fi] Gagal terhubung ke Wi-Fi atau timeout portal tercapai. Melanjutkan dengan mode jaringan mandiri.");
    wifiWasConnected = false;
  } else {
    wifiWasConnected = true;
    Serial.println("\n[Wi-Fi] Terhubung!");
    Serial.print("[Wi-Fi] IP Address ESP32 (STATIC): ");
    Serial.println(WiFi.localIP());

    if (MDNS.begin(mdns_hostname)) {
      Serial.printf("[mDNS] Domain lokal aktif: http://%s.local\n", mdns_hostname);
      MDNS.addService("http", "tcp", 80);
      MDNS.addService("ws", "tcp", 81);
    } else {
      Serial.println("[mDNS] Gagal memulai mDNS Server!");
    }
  }

  // 3. Jalankan HTTP REST Server
  httpServer.on("/api/status", handleApiStatus);
  httpServer.onNotFound(handleNotFound);
  httpServer.begin();
  Serial.println("[HTTP] Server berjalan di Port 80 (/api/status)");

  // 4. Jalankan WebSocket Server & Aktifkan Heartbeat (Ping 15s)
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  webSocket.enableHeartbeat(15000, 3000, 2); // Auto ping client per 15 detik
  Serial.println("[WebSocket] Server berjalan di Port 81 (Heartbeat Enabled)");
}

void loop() {
  // Selalu jalankan listener HTTP & WebSocket
  httpServer.handleClient();
  webSocket.loop();

  // -------------------------------------------------------------
  // LOGIKA AUTO RECONNECT WI-FI OTOMATIS & RE-INITIALIZATION
  // -------------------------------------------------------------
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiWasConnected) {
      wifiWasConnected = false;
      Serial.println("[Wi-Fi] Koneksi terputus! Memulai pencarian ulang Wi-Fi secara berkala...");
    }

    unsigned long currentMillis = millis();
    if (currentMillis - lastWiFiRetry >= wifiRetryInterval) {
      lastWiFiRetry = currentMillis;
      Serial.println("[Wi-Fi] Mencari dan mengaktifkan kembali koneksi Wi-Fi...");
      WiFi.reconnect();
    }
  } else {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      Serial.println("[Wi-Fi] Koneksi Wi-Fi berhasil pulih dan terhubung kembali!");
      Serial.print("[Wi-Fi] IP Address (STATIC): ");
      Serial.println(WiFi.localIP());

      // Re-inisialisasi mDNS saat koneksi Wi-Fi pulih
      if (MDNS.begin(mdns_hostname)) {
        MDNS.addService("http", "tcp", 80);
        MDNS.addService("ws", "tcp", 81);
      }
    }
  }

  unsigned long currentMillis = millis();

  // -------------------------------------------------------------
  // MONITORING MESIN 1 (GPIO 4)
  // -------------------------------------------------------------
  int currentM1State = digitalRead(MESIN_1_PIN);
  if (currentM1State != m1_lastRawState) {
    m1_lastDebounceTime = currentMillis;
    m1_lastRawState = currentM1State;
  }

  if ((currentMillis - m1_lastDebounceTime) > debounceDelay) {
    bool currentM1Active = (currentM1State == LOW);
    if (currentM1Active != m1_active) {
      m1_active = currentM1Active;
      digitalWrite(LED_M1_PIN, m1_active ? HIGH : LOW);

      String payload = String("{\"machine\":\"M1\",\"status\":\"") + (m1_active ? "START" : "STOP") + "\"}";
      Serial.printf("[SENSOR M1] Status Baru: %s => Broadcast WS: %s\n", m1_active ? "AKTIF" : "OFF", payload.c_str());
      
      webSocket.broadcastTXT(payload);
    }
  }

  // -------------------------------------------------------------
  // MONITORING MESIN 2 (GPIO 5)
  // -------------------------------------------------------------
  int currentM2State = digitalRead(MESIN_2_PIN);
  if (currentM2State != m2_lastRawState) {
    m2_lastDebounceTime = currentMillis;
    m2_lastRawState = currentM2State;
  }

  if ((currentMillis - m2_lastDebounceTime) > debounceDelay) {
    bool currentM2Active = (currentM2State == LOW);
    if (currentM2Active != m2_active) {
      m2_active = currentM2Active;

      String payload = String("{\"machine\":\"M2\",\"status\":\"") + (m2_active ? "START" : "STOP") + "\"}";
      Serial.printf("[SENSOR M2] Status Baru: %s => Broadcast WS: %s\n", m2_active ? "AKTIF" : "OFF", payload.c_str());
      
      webSocket.broadcastTXT(payload);
    }
  }

  delay(10);
}
