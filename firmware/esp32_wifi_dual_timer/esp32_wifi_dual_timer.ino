/*
 * =================================================================================
 * PROYEK: ESP32 WI-FI LOKAL MULTI-MACHINE DOWNTIME TIMER (3 MESIN)
 *         (WEB CONFIG PORTAL + PREFERENCES NVS + FALLBACK AP + WEBSOCKET HEARTBEAT)
 * Deskripsi: Program ESP32 untuk memantau hingga 3 Mesin sekaligus via Wi-Fi Lokal & WebSocket.
 *            - Mesin 1 (M1): GPIO 4  (Relay Sakelar M1)
 *            - Mesin 2 (M2): GPIO 22 (Relay Sakelar M2 - Bebas Boot Strap)
 *            - Mesin 3 (M3): GPIO 21 (Relay Sakelar M3 - Bebas Noise/SPI)
 *            - GND: Sambungkan kabel Ground (GND) ketiga relay secara paralel ke pin GND ESP32
 * 
 * FITUR GANTI WI-FI TANPA FLASHING:
 * 1. Saat Wi-Fi Pabrik aktif: Buka http://192.168.1.171/setting di browser HP/Tablet.
 * 2. Jika Wi-Fi pabrik mati / router diganti: ESP32 otomatis menyalakan Hotspot:
 *    - Nama Hotspot (SSID): "DJI-TIMER-SETUP"
 *    - Password Hotspot   : "AdminPabrik123"
 *    - Buka browser HP ke : http://192.168.4.1/setting
 *    - Pilih Wi-Fi pabrik baru, masukkan password, klik "Simpan & Restart".
 *    - Pengaturan tersimpan permanen di memori internal ESP32 (Preferences NVS).
 * =================================================================================
 */

#include <WiFi.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <Preferences.h>

// --- PREFERENCES (MEMORI PERMANEN INTERNAL ESP32) ---
Preferences preferences;
String currentSSID = "";
String currentPassword = "";

// Default Fallback Pabrik jika NVS masih kosong
const char* DEFAULT_SSID = "Dentelle";
const char* DEFAULT_PASS = "inovasikreasi88";

// --- KONFIGURASI STATIC IP DEFAULT (IP Tetap Permanen ESP32 di Pabrik) ---
IPAddress local_IP(192, 168, 1, 171);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(8, 8, 8, 8);
IPAddress secondaryDNS(8, 8, 4, 4);

// Domain mDNS lokal -> http://esp32-timer.local
const char* mdns_hostname = "esp32-timer";

// --- KONFIGURASI HARDWARE PIN ---
const int MESIN_1_PIN = 4;   // GPIO 4  (Input Relay Mesin 1)
const int MESIN_2_PIN = 22;  // GPIO 22 (Input Relay Mesin 2)
const int MESIN_3_PIN = 21;  // GPIO 21 (Input Relay Mesin 3)
const int LED_M1_PIN  = 2;   // Onboard LED ESP32 (Indikator Status Sinyal M1)

// --- SERVER INSTANCES ---
WebServer httpServer(80);
WebSocketsServer webSocket = WebSocketsServer(81);

// --- STATE PELACAK DOWNTIME MESIN & WI-FI ---
bool m1_active = false;
bool m2_active = false;
bool m3_active = false;

unsigned long m1_downtimeStartTime = 0;
unsigned long m2_downtimeStartTime = 0;
unsigned long m3_downtimeStartTime = 0;

bool wifiWasConnected = false;
bool isApMode = false;
unsigned long lastWiFiRetry = 0;
const unsigned long wifiRetryInterval = 5000; // Coba reconnect setiap 5 detik jika mati

// Debounce state Mesin 1, 2, 3
int m1_lastRawState = HIGH;
unsigned long m1_lastDebounceTime = 0;

int m2_lastRawState = HIGH;
unsigned long m2_lastDebounceTime = 0;

int m3_lastRawState = HIGH;
unsigned long m3_lastDebounceTime = 0;

const unsigned long debounceDelay = 500; // Stabilisasi sinyal 500ms

// --- HANDLER WEBSOCKET EVENT ---
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.printf("[WebSocket] Client [%u] Terputus!
", num);
      break;

    case WStype_PING:
      break;

    case WStype_PONG:
      break;

    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf("[WebSocket] Client [%u] Terhubung dari %d.%d.%d.%d
", num, ip[0], ip[1], ip[2], ip[3]);

      unsigned long d1 = m1_active ? ((millis() - m1_downtimeStartTime) / 1000) : 0;
      unsigned long d2 = m2_active ? ((millis() - m2_downtimeStartTime) / 1000) : 0;
      unsigned long d3 = m3_active ? ((millis() - m3_downtimeStartTime) / 1000) : 0;

      String payloadM1 = String("{\"machine\":\"M1\",\"status\":\"") + (m1_active ? "START" : "STOP") + "\",\"duration\":" + String(d1) + "}";
      String payloadM2 = String("{\"machine\":\"M2\",\"status\":\"") + (m2_active ? "START" : "STOP") + "\",\"duration\":" + String(d2) + "}";
      String payloadM3 = String("{\"machine\":\"M3\",\"status\":\"") + (m3_active ? "START" : "STOP") + "\",\"duration\":" + String(d3) + "}";

      webSocket.sendTXT(num, payloadM1);
      webSocket.sendTXT(num, payloadM2);
      webSocket.sendTXT(num, payloadM3);
      break;
    }

    case WStype_TEXT:
      if (strcmp((char*)payload, "PING") == 0) {
        webSocket.sendTXT(num, "PONG");
      } else if (strcmp((char*)payload, "GET_STATUS") == 0) {
        unsigned long d1 = m1_active ? ((millis() - m1_downtimeStartTime) / 1000) : 0;
        unsigned long d2 = m2_active ? ((millis() - m2_downtimeStartTime) / 1000) : 0;
        unsigned long d3 = m3_active ? ((millis() - m3_downtimeStartTime) / 1000) : 0;

        String payloadM1 = String("{\"machine\":\"M1\",\"status\":\"") + (m1_active ? "START" : "STOP") + "\",\"duration\":" + String(d1) + "}";
        String payloadM2 = String("{\"machine\":\"M2\",\"status\":\"") + (m2_active ? "START" : "STOP") + "\",\"duration\":" + String(d2) + "}";
        String payloadM3 = String("{\"machine\":\"M3\",\"status\":\"") + (m3_active ? "START" : "STOP") + "\",\"duration\":" + String(d3) + "}";
        webSocket.sendTXT(num, payloadM1);
        webSocket.sendTXT(num, payloadM2);
        webSocket.sendTXT(num, payloadM3);
      }
      break;

    default:
      break;
  }
}

// --- HANDLER HTTP API REST STATUS (PORT 80) ---
void handleApiStatus() {
  unsigned long d1 = m1_active ? ((millis() - m1_downtimeStartTime) / 1000) : 0;
  unsigned long d2 = m2_active ? ((millis() - m2_downtimeStartTime) / 1000) : 0;
  unsigned long d3 = m3_active ? ((millis() - m3_downtimeStartTime) / 1000) : 0;

  uint8_t wsClientCount = webSocket.connectedClients();
  String ipStr = isApMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();

  String json = "{\"status\":\"OK\","
                "\"m1\":\"" + String(m1_active ? "START" : "STOP") + "\",\"m1_dur\":" + String(d1) + ","
                "\"m2\":\"" + String(m2_active ? "START" : "STOP") + "\",\"m2_dur\":" + String(d2) + ","
                "\"m3\":\"" + String(m3_active ? "START" : "STOP") + "\",\"m3_dur\":" + String(d3) + ","
                "\"ws_clients\":" + String(wsClientCount) + ","
                "\"mode\":\"" + String(isApMode ? "AP_HOTSPOT" : "STATION_CONNECTED") + "\","
                "\"ssid\":\"" + currentSSID + "\","
                "\"ip\":\"" + ipStr + "\","
                "\"mdns\":\"http://esp32-timer.local\"}";

  httpServer.sendHeader("Access-Control-Allow-Origin", "*");
  httpServer.send(200, "application/json", json);
}

// --- HANDLER WEB PORTAL SETTING WI-FI (HTML UI) ---
void handleSettingPage() {
  String ipStr = isApMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();

  String html = "<!DOCTYPE html><html lang='id'><head><meta charset='UTF-8'>"
                "<meta name='viewport' content='width=device-width,initial-scale=1.0'>"
                "<title>Pengaturan Wi-Fi ESP32 - DJI</title>"
                "<style>"
                "body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;margin:0;padding:24px 16px;display:flex;justify-content:center;}"
                ".card{background:#1e293b;width:100%;max-width:440px;border-radius:24px;border:1px solid #334155;padding:28px 24px;box-shadow:0 20px 40px rgba(0,0,0,0.5);}"
                "h2{margin:0 0 6px;color:#38bdf8;font-size:22px;font-weight:900;}"
                "p{color:#94a3b8;font-size:13px;margin:0 0 24px;line-height:1.5;}"
                ".badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:800;text-transform:uppercase;margin-bottom:16px;"
                + String(isApMode ? "background:#f43f5e;color:#fff;'>" : "background:#0284c7;color:#fff;'>")
                + (isApMode ? "Mode: Hotspot Setup (192.168.4.1)" : "Mode: Terhubung Pabrik (" + ipStr + ")")
                + "</div>"
                "<form action='/api/wifi-save' method='POST'>"
                "<label style='display:block;font-size:12px;font-weight:700;color:#cbd5e1;margin-bottom:6px;'>Nama Wi-Fi (SSID):</label>"
                "<input type='text' name='ssid' value='" + currentSSID + "' required style='width:100%;box-sizing:border-box;padding:12px 14px;background:#0f172a;border:1px solid #475569;border-radius:12px;color:#fff;font-size:14px;margin-bottom:18px;outline:none;'>"
                "<label style='display:block;font-size:12px;font-weight:700;color:#cbd5e1;margin-bottom:6px;'>Password Wi-Fi:</label>"
                "<input type='password' name='password' value='" + currentPassword + "' required style='width:100%;box-sizing:border-box;padding:12px 14px;background:#0f172a;border:1px solid #475569;border-radius:12px;color:#fff;font-size:14px;margin-bottom:24px;outline:none;'>"
                "<button type='submit' style='width:100%;padding:14px;background:linear-gradient(135deg,#0284c7,#0369a1);border:none;border-radius:14px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 6px 20px rgba(2,132,199,0.35);'>Simpan & Hubungkan &rarr;</button>"
                "</form>"
                "<div style='margin-top:24px;padding-top:16px;border-top:1px solid #334155;text-align:center;font-size:11px;color:#64748b;'>"
                "PT Dentelle Jaya Infinitex &bull; ESP32 Dual Timer v2.1"
                "</div>"
                "</div></body></html>";

  httpServer.sendHeader("Access-Control-Allow-Origin", "*");
  httpServer.send(200, "text/html", html);
}

// --- HANDLER SIMPAN WI-FI DARI FORM ---
void handleSaveWifi() {
  if (httpServer.hasArg("ssid") && httpServer.hasArg("password")) {
    String newSsid = httpServer.arg("ssid");
    String newPass = httpServer.arg("password");

    newSsid.trim();
    newPass.trim();

    if (newSsid.length() > 0) {
      preferences.putString("ssid", newSsid);
      preferences.putString("pass", newPass);

      String respHtml = "<!DOCTYPE html><html lang='id'><head><meta charset='UTF-8'>"
                        "<meta name='viewport' content='width=device-width,initial-scale=1.0'>"
                        "<title>Menyimpan Pengaturan...</title>"
                        "<style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#fff;text-align:center;padding:50px 20px;}"
                        ".box{background:#1e293b;max-width:380px;margin:0 auto;padding:32px;border-radius:20px;border:1px solid #334155;}"
                        "h3{color:#38bdf8;margin-bottom:8px;}</style></head><body>"
                        "<div class='box'>"
                        "<h3>Wi-Fi Berhasil Disimpan!</h3>"
                        "<p style='color:#94a3b8;font-size:13px;line-height:1.6;'>ESP32 sedang merestart untuk menghubungkan ke <b>" + newSsid + "</b>.<br><br>Silakan sambungkan kembali HP/Tablet ke Wi-Fi pabrik tersebut.</p>"
                        "</div></body></html>";

      httpServer.send(200, "text/html", respHtml);
      delay(1500);
      ESP.restart();
      return;
    }
  }

  httpServer.send(400, "text/plain", "Bad Request: SSID tidak boleh kosong.");
}

void handleNotFound() {
  // Jika di mode Hotspot setup, redirect apapun ke /setting
  if (isApMode) {
    httpServer.sendHeader("Location", "/setting");
    httpServer.send(302, "text/plain", "Redirecting to /setting");
    return;
  }
  httpServer.sendHeader("Access-Control-Allow-Origin", "*");
  httpServer.send(404, "text/plain", "404 Not Found - Akses /setting atau /api/status");
}

void setup() {
  Serial.begin(115200);
  delay(500);

  // 1. Inisialisasi NVS Preferences untuk membaca Wi-Fi tersimpan
  preferences.begin("dji_wifi", false);
  currentSSID = preferences.getString("ssid", DEFAULT_SSID);
  currentPassword = preferences.getString("pass", DEFAULT_PASS);

  // 2. Konfigurasi Input Pin dengan Pull-Up Internal
  pinMode(MESIN_1_PIN, INPUT_PULLUP);
  pinMode(MESIN_2_PIN, INPUT_PULLUP);
  pinMode(MESIN_3_PIN, INPUT_PULLUP);

  pinMode(LED_M1_PIN, OUTPUT);
  digitalWrite(LED_M1_PIN, LOW);

  m1_lastRawState = digitalRead(MESIN_1_PIN);
  m1_active       = (m1_lastRawState == LOW);
  if (m1_active) m1_downtimeStartTime = millis();

  m2_lastRawState = digitalRead(MESIN_2_PIN);
  m2_active       = (m2_lastRawState == LOW);
  if (m2_active) m2_downtimeStartTime = millis();

  m3_lastRawState = digitalRead(MESIN_3_PIN);
  m3_active       = (m3_lastRawState == LOW);
  if (m3_active) m3_downtimeStartTime = millis();

  Serial.println("\n=============================================");
  Serial.println("  ESP32 3-MACHINE WI-FI TIMER STARTING...    ");
  Serial.println("=============================================");
  Serial.printf("[Wi-Fi Config] Target SSID: %s\n", currentSSID.c_str());

  // 3. Coba Terhubung ke Wi-Fi Station Mode dengan Static IP
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.setSleep(false); // Matikan sleep mode agar antena selalu responsif

  if (!WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS)) {
    Serial.println("[Wi-Fi] Gagal set Static IP, menggunakan DHCP.");
  }

  WiFi.begin(currentSSID.c_str(), currentPassword.c_str());

  // Tunggu maksimal 15 detik (30 x 500ms)
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    isApMode = false;
    wifiWasConnected = true;
    Serial.println("\n[Wi-Fi] TERHUBUNG SUKSES!");
    Serial.print("[Wi-Fi] IP Address (STATIC): ");
    Serial.println(WiFi.localIP());

    if (MDNS.begin(mdns_hostname)) {
      Serial.printf("[mDNS] Domain lokal: http://%s.local\n", mdns_hostname);
      MDNS.addService("http", "tcp", 80);
      MDNS.addService("ws", "tcp", 81);
    }
  } else {
    // 4. Fallback Hotspot Darurat jika Wi-Fi pabrik gagal konek
    isApMode = true;
    wifiWasConnected = false;
    Serial.println("\n[Wi-Fi] GAGAL terhubung ke Wi-Fi pabrik!");
    Serial.println("[Wi-Fi] Mengaktifkan Hotspot Darurat: DJI-TIMER-SETUP ...");

    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP("DJI-TIMER-SETUP", "AdminPabrik123");

    Serial.print("[Hotspot AP] IP Address Hotspot: ");
    Serial.println(WiFi.softAPIP());
    Serial.println("[Hotspot AP] Sambungkan HP ke 'DJI-TIMER-SETUP' (Pass: AdminPabrik123) lalu buka http://192.168.4.1/setting");
  }

  // 5. Daftarkan Rute Web Server
  httpServer.on("/", handleSettingPage);
  httpServer.on("/setting", handleSettingPage);
  httpServer.on("/api/status", handleApiStatus);
  httpServer.on("/api/wifi-save", HTTP_POST, handleSaveWifi);
  httpServer.onNotFound(handleNotFound);
  httpServer.begin();
  Serial.println("[HTTP] Server berjalan di Port 80 (Endpoint: /setting & /api/status)");

  // 6. Jalankan WebSocket Server Port 81
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  webSocket.enableHeartbeat(60000, 10000, 3);
  Serial.println("[WebSocket] Server aktif di Port 81 (Heartbeat: 60s ping)");
}

void loop() {
  httpServer.handleClient();
  webSocket.loop();

  // Reconnect otomatis hanya jika bukan mode AP aktif
  if (!isApMode && WiFi.status() != WL_CONNECTED) {
    if (wifiWasConnected) {
      wifiWasConnected = false;
      Serial.println("[Wi-Fi] Sinyal terputus! Mencoba reconnect...");
    }

    unsigned long currentMillis = millis();
    if (currentMillis - lastWiFiRetry >= wifiRetryInterval) {
      lastWiFiRetry = currentMillis;
      WiFi.reconnect();
    }
  } else if (!isApMode && !wifiWasConnected && WiFi.status() == WL_CONNECTED) {
    wifiWasConnected = true;
    Serial.println("[Wi-Fi] Terhubung kembali ke Wi-Fi pabrik!");
  }

  unsigned long currentMillis = millis();

  // MONITORING MESIN 1 (GPIO 4)
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

      unsigned long durasi = 0;
      if (m1_active) {
        m1_downtimeStartTime = currentMillis;
      } else {
        durasi = (currentMillis - m1_downtimeStartTime) / 1000;
      }

      String payload = String("{\"machine\":\"M1\",\"status\":\"") + (m1_active ? "START" : "STOP") + "\",\"duration\":" + String(durasi) + "}";
      webSocket.broadcastTXT(payload);
    }
  }

  // MONITORING MESIN 2 (GPIO 22)
  int currentM2State = digitalRead(MESIN_2_PIN);
  if (currentM2State != m2_lastRawState) {
    m2_lastDebounceTime = currentMillis;
    m2_lastRawState = currentM2State;
  }
  if ((currentMillis - m2_lastDebounceTime) > debounceDelay) {
    bool currentM2Active = (currentM2State == LOW);
    if (currentM2Active != m2_active) {
      m2_active = currentM2Active;

      unsigned long durasi = 0;
      if (m2_active) {
        m2_downtimeStartTime = currentMillis;
      } else {
        durasi = (currentMillis - m2_downtimeStartTime) / 1000;
      }

      String payload = String("{\"machine\":\"M2\",\"status\":\"") + (m2_active ? "START" : "STOP") + "\",\"duration\":" + String(durasi) + "}";
      webSocket.broadcastTXT(payload);
    }
  }

  // MONITORING MESIN 3 (GPIO 21)
  int currentM3State = digitalRead(MESIN_3_PIN);
  if (currentM3State != m3_lastRawState) {
    m3_lastDebounceTime = currentMillis;
    m3_lastRawState = currentM3State;
  }
  if ((currentMillis - m3_lastDebounceTime) > debounceDelay) {
    bool currentM3Active = (currentM3State == LOW);
    if (currentM3Active != m3_active) {
      m3_active = currentM3Active;

      unsigned long durasi = 0;
      if (m3_active) {
        m3_downtimeStartTime = currentMillis;
      } else {
        durasi = (currentMillis - m3_downtimeStartTime) / 1000;
      }

      String payload = String("{\"machine\":\"M3\",\"status\":\"") + (m3_active ? "START" : "STOP") + "\",\"duration\":" + String(durasi) + "}";
      webSocket.broadcastTXT(payload);
    }
  }

  delay(10);
}
