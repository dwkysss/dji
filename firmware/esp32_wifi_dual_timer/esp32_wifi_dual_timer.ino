/*
 * =================================================================================
 * PROYEK: ESP32 WI-FI LOKAL MULTI-MACHINE DOWNTIME TIMER (3 MESIN)
 *         (WEB CONFIG PORTAL + PREFERENCES NVS + FALLBACK AP + WEBSOCKET HEARTBEAT
 *          + MANAJEMEN PERANGKAT TERHUBUNG / DISCONNECT CLIENT)
 * Deskripsi: Program ESP32 untuk memantau hingga 3 Mesin sekaligus via Wi-Fi Lokal & WebSocket.
 *            - Mesin 1 (M1): GPIO 4  (Relay Sakelar M1)
 *            - Mesin 2 (M2): GPIO 22 (Relay Sakelar M2 - Bebas Boot Strap)
 *            - Mesin 3 (M3): GPIO 21 (Relay Sakelar M3 - Bebas Noise/SPI)
 *            - GND: Sambungkan kabel Ground (GND) ketiga relay secara paralel ke pin GND ESP32
 * 
 * FITUR UTAMA:
 * 1. Web Portal di http://192.168.1.171/setting
 * 2. Manajemen Perangkat: Lihat daftar IP Tablet/HP yang aktif terhubung, serta tombol Putuskan (Kick)
 * 3. Ganti Wi-Fi tanpa flashing (NVS Preferences)
 * 4. Fallback Hotspot jika Wi-Fi mati (nama dan password di secrets.h, IP: 192.168.4.1)
 * =================================================================================
 */

#include <WiFi.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <Preferences.h>
#include "secrets.h"

// --- PREFERENCES (MEMORI PERMANEN INTERNAL ESP32) ---
Preferences preferences;
String currentSSID = "";
String currentPassword = "";

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

// Semua halaman/aksi administrasi wajib memakai Basic Auth.
// Kredensial disimpan di secrets.h yang tidak ikut Git.
bool requireAdmin() {
  if (httpServer.authenticate(PORTAL_ADMIN_USER, PORTAL_ADMIN_PASSWORD)) {
    return true;
  }

  httpServer.requestAuthentication(BASIC_AUTH, "DJI Timer Admin", "Login admin diperlukan");
  return false;
}

// --- STRUKTUR PELACAK PERANGKAT TERHUBUNG ---
struct WsClientTracker {
  bool active;
  IPAddress ip;
  unsigned long connectMillis;
};
const uint8_t MAX_TRACKED_CLIENTS = 10;
WsClientTracker trackedClients[MAX_TRACKED_CLIENTS];

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
unsigned long wifiDisconnectedSince = 0;
const unsigned long wifiFallbackDelay = 30000; // Aktifkan AP setelah Wi-Fi putus 30 detik
bool mdnsStarted = false;

// Debounce state Mesin 1, 2, 3
int m1_lastRawState = HIGH;
unsigned long m1_lastDebounceTime = 0;

int m2_lastRawState = HIGH;
unsigned long m2_lastDebounceTime = 0;

int m3_lastRawState = HIGH;
unsigned long m3_lastDebounceTime = 0;

const unsigned long debounceDelay = 500; // Stabilisasi sinyal 500ms

void startMdns() {
  if (mdnsStarted) return;

  if (MDNS.begin(mdns_hostname)) {
    mdnsStarted = true;
    MDNS.addService("http", "tcp", 80);
    MDNS.addService("ws", "tcp", 81);
    Serial.printf("[mDNS] Domain lokal: http://%s.local\n", mdns_hostname);
  } else {
    Serial.println("[mDNS] Gagal memulai mDNS.");
  }
}

void startSetupAccessPoint() {
  if (isApMode) return;

  WiFi.mode(WIFI_AP_STA);
  if (WiFi.softAP(SETUP_AP_SSID, SETUP_AP_PASSWORD)) {
    isApMode = true;
    Serial.printf("[Hotspot AP] Aktif: %s (%s)\n", SETUP_AP_SSID, WiFi.softAPIP().toString().c_str());
  } else {
    Serial.println("[Hotspot AP] Gagal diaktifkan.");
  }
}

void handleStationConnected() {
  if (isApMode) {
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);
    isApMode = false;
    Serial.println("[Hotspot AP] Ditutup karena Wi-Fi pabrik sudah terhubung.");
  }

  wifiWasConnected = true;
  wifiDisconnectedSince = 0;
  startMdns();
}

void sendMachineStatusToClient(uint8_t client, const char* machine, bool active, unsigned long duration) {
  char payload[72];
  int length = snprintf(payload, sizeof(payload),
                        "{\"machine\":\"%s\",\"status\":\"%s\",\"duration\":%lu}",
                        machine, active ? "START" : "STOP", duration);

  if (length > 0 && length < static_cast<int>(sizeof(payload))) {
    webSocket.sendTXT(client, reinterpret_cast<uint8_t*>(payload), length);
  }
}

void broadcastMachineStatus(const char* machine, bool active, unsigned long duration) {
  char payload[72];
  int length = snprintf(payload, sizeof(payload),
                        "{\"machine\":\"%s\",\"status\":\"%s\",\"duration\":%lu}",
                        machine, active ? "START" : "STOP", duration);

  if (length > 0 && length < static_cast<int>(sizeof(payload))) {
    webSocket.broadcastTXT(reinterpret_cast<uint8_t*>(payload), length);
  }
}

void sendAllMachineStatusToClient(uint8_t client) {
  unsigned long d1 = m1_active ? ((millis() - m1_downtimeStartTime) / 1000) : 0;
  unsigned long d2 = m2_active ? ((millis() - m2_downtimeStartTime) / 1000) : 0;
  unsigned long d3 = m3_active ? ((millis() - m3_downtimeStartTime) / 1000) : 0;

  sendMachineStatusToClient(client, "M1", m1_active, d1);
  sendMachineStatusToClient(client, "M2", m2_active, d2);
  sendMachineStatusToClient(client, "M3", m3_active, d3);
}

// --- HANDLER WEBSOCKET EVENT ---
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.printf("[WebSocket] Client [%u] Terputus!\n", num);
      if (num < MAX_TRACKED_CLIENTS) {
        trackedClients[num].active = false;
      }
      break;

    case WStype_PING:
      break;

    case WStype_PONG:
      break;

    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf("[WebSocket] Client [%u] Terhubung dari %d.%d.%d.%d\n", num, ip[0], ip[1], ip[2], ip[3]);

      if (num < MAX_TRACKED_CLIENTS) {
        trackedClients[num].active = true;
        trackedClients[num].ip = ip;
        trackedClients[num].connectMillis = millis();
      }

      sendAllMachineStatusToClient(num);
      break;
    }

    case WStype_TEXT:
      if (strcmp((char*)payload, "PING") == 0) {
        webSocket.sendTXT(num, "PONG");
      } else if (strcmp((char*)payload, "GET_STATUS") == 0) {
        sendAllMachineStatusToClient(num);
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

  uint8_t wsClientCount = 0;
  String clientsJson = "[";
  bool firstClient = true;
  for (uint8_t i = 0; i < MAX_TRACKED_CLIENTS; i++) {
    if (trackedClients[i].active) {
      wsClientCount++;
      unsigned long onlineSec = (millis() - trackedClients[i].connectMillis) / 1000;
      if (!firstClient) clientsJson += ",";
      clientsJson += "{\"id\":" + String(i) + ",\"ip\":\"" + trackedClients[i].ip.toString() + "\",\"online_sec\":" + String(onlineSec) + "}";
      firstClient = false;
    }
  }
  clientsJson += "]";

  String ipStr = isApMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();

  String json = "{\"status\":\"OK\","
                "\"m1\":\"" + String(m1_active ? "START" : "STOP") + "\",\"m1_dur\":" + String(d1) + ","
                "\"m2\":\"" + String(m2_active ? "START" : "STOP") + "\",\"m2_dur\":" + String(d2) + ","
                "\"m3\":\"" + String(m3_active ? "START" : "STOP") + "\",\"m3_dur\":" + String(d3) + ","
                "\"ws_clients\":" + String(wsClientCount) + ","
                "\"clients\":" + clientsJson + ","
                "\"mode\":\"" + String(isApMode ? "AP_HOTSPOT" : "STATION_CONNECTED") + "\","
                "\"ssid\":\"" + currentSSID + "\","
                "\"ip\":\"" + ipStr + "\","
                "\"mdns\":\"http://esp32-timer.local\"}";

  httpServer.sendHeader("Access-Control-Allow-Origin", "*");
  httpServer.send(200, "application/json", json);
}

// --- HANDLER PUTUSKAN CLIENT (DISCONNECT) ---
void handleDisconnectClient() {
  if (!requireAdmin()) return;

  if (httpServer.hasArg("id")) {
    String idArg = httpServer.arg("id");
    bool isNumericId = idArg.length() > 0;
    for (size_t i = 0; i < idArg.length(); i++) {
      if (!isDigit(idArg[i])) {
        isNumericId = false;
        break;
      }
    }

    long parsedId = isNumericId ? idArg.toInt() : -1;
    if (parsedId >= 0 && parsedId < MAX_TRACKED_CLIENTS && trackedClients[parsedId].active) {
      uint8_t id = static_cast<uint8_t>(parsedId);
      Serial.printf("[WebSocket] Memutuskan Client [%u] (%s) via Web UI...\n", id, trackedClients[id].ip.toString().c_str());
      webSocket.disconnect(id);
      trackedClients[id].active = false;
    }
  }
  httpServer.sendHeader("Location", "/setting");
  httpServer.send(302, "text/plain", "Redirecting to /setting");
}

// --- HANDLER PUTUSKAN SEMUA CLIENT (DISCONNECT ALL) ---
void handleDisconnectAllClients() {
  if (!requireAdmin()) return;

  Serial.println("[WebSocket] Memutuskan SEMUA Client via Web UI...");
  for (uint8_t i = 0; i < MAX_TRACKED_CLIENTS; i++) {
    if (trackedClients[i].active) {
      webSocket.disconnect(i);
      trackedClients[i].active = false;
    }
  }
  httpServer.sendHeader("Location", "/setting");
  httpServer.send(302, "text/plain", "Redirecting to /setting");
}

// --- HANDLER WEB PORTAL PENGATURAN & MANAJEMEN PERANGKAT (HTML UI) ---
void handleSettingPage() {
  if (!requireAdmin()) return;

  String ipStr = isApMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();

  // Hitung jumlah client aktif
  uint8_t activeCount = 0;
  for (uint8_t i = 0; i < MAX_TRACKED_CLIENTS; i++) {
    if (trackedClients[i].active) activeCount++;
  }

  String html = "<!DOCTYPE html><html lang='id'><head><meta charset='UTF-8'>"
                "<meta name='viewport' content='width=device-width,initial-scale=1.0'>"
                "<title>Manajemen Sensor ESP32 - DJI</title>"
                "<style>"
                "* {box-sizing:border-box;margin:0;padding:0;}"
                "body{font-family:system-ui,-apple-system,sans-serif;background:#090d16;color:#f8fafc;padding:20px 14px;display:flex;justify-content:center;}"
                ".container{width:100%;max-width:480px;display:flex;flex-direction:column;gap:18px;}"
                ".card{background:#131c2e;border-radius:24px;border:1px solid #1e293b;padding:22px 20px;box-shadow:0 15px 35px rgba(0,0,0,0.45);}"
                "h2{color:#38bdf8;font-size:20px;font-weight:900;letter-spacing:-0.02em;margin-bottom:4px;display:flex;align-items:center;gap:8px;}"
                "p.subtitle{color:#94a3b8;font-size:12.5px;margin-bottom:18px;line-height:1.5;}"
                ".badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;text-transform:uppercase;margin-bottom:16px;}"
                ".badge-hotspot{background:#881337;color:#f43f5e;border:1px solid #be123c;}"
                ".badge-online{background:#082f49;color:#38bdf8;border:1px solid #0284c7;}"
                ".section-title{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#cbd5e1;margin-bottom:12px;display:flex;justify-content:between;align-items:center;}"
                ".client-item{background:#0b1120;border:1px solid #1e293b;border-radius:16px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}"
                ".client-info{display:flex;flex-direction:column;gap:2px;}"
                ".client-ip{font-family:monospace;font-size:14px;font-weight:800;color:#f1f5f9;display:flex;align-items:center;gap:6px;}"
                ".dot-green{width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;display:inline-block;}"
                ".client-meta{font-size:11px;color:#64748b;font-weight:600;}"
                ".btn-kick{background:#ef4444;color:#fff;border:none;border-radius:10px;padding:7px 12px;font-size:11px;font-weight:800;cursor:pointer;text-decoration:none;transition:0.15s;display:inline-block;}"
                ".btn-kick:hover{background:#dc2626;}"
                ".btn-kick-all{background:#334155;color:#f8fafc;border:none;border-radius:10px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;text-decoration:none;transition:0.15s;}"
                ".btn-kick-all:hover{background:#475569;}"
                ".empty-box{background:#0b1120;border:1px dashed #334155;border-radius:16px;padding:24px 16px;text-align:center;color:#64748b;font-size:12px;line-height:1.6;}"
                ".guide-box{background:#0b1526;border:1px solid #0369a1;border-radius:16px;padding:14px;margin-top:14px;font-size:11.5px;color:#93c5fd;line-height:1.5;}"
                ".guide-box strong{color:#38bdf8;}"
                "label{display:block;font-size:11.5px;font-weight:700;color:#cbd5e1;margin-bottom:6px;}"
                "input[type='text'],input[type='password']{width:100%;box-sizing:border-box;padding:12px 14px;background:#090d16;border:1px solid #334155;border-radius:14px;color:#fff;font-size:13.5px;margin-bottom:14px;outline:none;}"
                "input:focus{border-color:#38bdf8;box-shadow:0 0 0 2px rgba(56,189,248,0.2);}"
                ".btn-submit{width:100%;padding:13px;background:linear-gradient(135deg,#0284c7,#0369a1);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 6px 20px rgba(2,132,199,0.3);}"
                ".btn-refresh{background:#1e293b;color:#38bdf8;border:1px solid #334155;border-radius:10px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer;text-decoration:none;}"
                ".footer{text-align:center;font-size:11px;color:#475569;margin-top:8px;}"
                "</style></head><body>"
                "<div class='container'>"

                // KARTU 1: MANAJEMEN PERANGKAT TERHUBUNG
                "<div class='card'>"
                "<div style='display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;'>"
                "<h2>📱 Perangkat Terhubung</h2>"
                "<a href='/setting' class='btn-refresh'>&#x21bb; Refresh</a>"
                "</div>"
                "<p class='subtitle'>Tablet / HP yang saat ini sedang aktif menerima sinyal sensor mesin via WebSocket.</p>"

                "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;'>"
                "<div class='badge badge-online'><span class='dot-green'></span> " + String(activeCount) + " Tablet / HP Aktif</div>";

  if (activeCount > 1) {
    html += "<form action='/api/client-disconnect-all' method='POST' style='display:inline' onsubmit='return confirm(\"Putuskan SEMUA perangkat yang sedang tersambung?\")'>"
            "<button type='submit' class='btn-kick-all'>Putuskan Semua</button></form>";
  }

  html += "</div>";

  // List perangkat
  if (activeCount == 0) {
    html += "<div class='empty-box'>"
            "Belum ada Tablet atau HP yang tersambung saat ini.<br>"
            "Buka aplikasi DJI di tablet operator untuk otomatis menyambung."
            "</div>";
  } else {
    for (uint8_t i = 0; i < MAX_TRACKED_CLIENTS; i++) {
      if (trackedClients[i].active) {
        unsigned long durSec = (millis() - trackedClients[i].connectMillis) / 1000;
        String durText = "";
        if (durSec < 60) {
          durText = String(durSec) + " dtk lalu";
        } else if (durSec < 3600) {
          durText = String(durSec / 60) + " mnt lalu";
        } else {
          durText = String(durSec / 3600) + " jam lalu";
        }

        html += "<div class='client-item'>"
                "<div class='client-info'>"
                "<div class='client-ip'><span class='dot-green'></span> " + trackedClients[i].ip.toString() + "</div>"
                "<span class='client-meta'>Client #" + String(i) + " &bull; Online: " + durText + "</span>"
                "</div>"
                "<form action='/api/client-disconnect' method='POST' style='display:inline' onsubmit='return confirm(\"Yakin ingin memutuskan koneksi perangkat ini?\")'>"
                "<input type='hidden' name='id' value='" + String(i) + "'>"
                "<button type='submit' class='btn-kick'>Putuskan</button></form>"
                "</div>";
      }
    }
  }

  // Petunjuk Tambah Perangkat
  html += "<div class='guide-box'>"
          "<strong>💡 Cara Menambahkan Perangkat Baru:</strong><br>"
          "1. Sambungkan Tablet/HP baru ke Wi-Fi pabrik (<b>" + (currentSSID.length() > 0 ? currentSSID : String(DEFAULT_WIFI_SSID)) + "</b>).<br>"
          "2. Buka aplikasi DJI atau buka browser ke: <b>http://" + ipStr + "</b><br>"
          "3. Perangkat akan otomatis terdaftar dan muncul di daftar atas ini."
          "</div>"
          "</div>" // Akhir Kartu 1

          // KARTU 2: PENGATURAN WI-FI PABRIK
          "<div class='card'>"
          "<h2>📶 Pengaturan Wi-Fi ESP32</h2>"
          "<p class='subtitle'>Ganti koneksi Wi-Fi pabrik tanpa perlu bongkar atau memprogram ulang kabel.</p>"
          "<div class='badge " + String(isApMode ? "badge-hotspot'>" : "badge-online'>")
          + (isApMode ? "Mode: Hotspot Setup (192.168.4.1)" : "Mode: Terhubung Pabrik (" + ipStr + ")")
          + "</div>"
          "<form action='/api/wifi-save' method='POST'>"
          "<label>Nama Wi-Fi (SSID):</label>"
          "<input type='text' name='ssid' value='" + currentSSID + "' required placeholder='Nama SSID Wi-Fi'>"
          "<label>Password Wi-Fi:</label>"
          "<input type='password' name='password' placeholder='Kosongkan untuk mempertahankan password saat ini'>"
          "<button type='submit' class='btn-submit'>Simpan & Hubungkan Wi-Fi &rarr;</button>"
          "</form>"
          "</div>" // Akhir Kartu 2

          "<div class='footer'>PT Dentelle Jaya Infinitex &bull; ESP32 Multi-Timer v2.2</div>"
          "</div></body></html>";

  httpServer.sendHeader("Access-Control-Allow-Origin", "*");
  httpServer.send(200, "text/html", html);
}

// --- HANDLER SIMPAN WI-FI DARI FORM ---
void handleSaveWifi() {
  if (!requireAdmin()) return;

  if (httpServer.hasArg("ssid")) {
    String newSsid = httpServer.arg("ssid");
    String newPass = httpServer.hasArg("password") ? httpServer.arg("password") : "";

    newSsid.trim();

    if (newSsid.length() > 0) {
      preferences.putString("ssid", newSsid);
      if (newPass.length() > 0) {
        preferences.putString("pass", newPass);
      }

      String respHtml = "<!DOCTYPE html><html lang='id'><head><meta charset='UTF-8'>"
                        "<meta name='viewport' content='width=device-width,initial-scale=1.0'>"
                        "<title>Menyimpan Pengaturan...</title>"
                        "<style>body{font-family:system-ui,sans-serif;background:#090d16;color:#fff;text-align:center;padding:50px 20px;}"
                        ".box{background:#131c2e;max-width:380px;margin:0 auto;padding:32px;border-radius:20px;border:1px solid #1e293b;}"
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

  // Inisialisasi daftar client
  for (uint8_t i = 0; i < MAX_TRACKED_CLIENTS; i++) {
    trackedClients[i].active = false;
  }

  // 1. Inisialisasi NVS Preferences untuk membaca Wi-Fi tersimpan
  preferences.begin("dji_wifi", false);
  currentSSID = preferences.getString("ssid", DEFAULT_WIFI_SSID);
  currentPassword = preferences.getString("pass", DEFAULT_WIFI_PASSWORD);

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

  // 3. Konfigurasi Wi-Fi Mode
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false); // Matikan power saving agar latensi WebSocket selalu < 5ms

  // Tetapkan Static IP 192.168.1.171
  if (!WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS)) {
    Serial.println("[Wi-Fi] GAGAL mengatur Static IP!");
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
    Serial.println("\n[Wi-Fi] TERHUBUNG SUKSES!");
    Serial.print("[Wi-Fi] IP Address (STATIC): ");
    Serial.println(WiFi.localIP());
    handleStationConnected();
  } else {
    // 4. Fallback Hotspot Darurat jika Wi-Fi pabrik gagal konek
    wifiWasConnected = false;
    wifiDisconnectedSince = millis();
    Serial.println("\n[Wi-Fi] GAGAL terhubung ke Wi-Fi pabrik!");
    Serial.println("[Wi-Fi] Mengaktifkan Hotspot Darurat: DJI-TIMER-SETUP ...");
    startSetupAccessPoint();
    Serial.printf("[Hotspot AP] Sambungkan HP ke '%s' lalu buka http://192.168.4.1/setting\n", SETUP_AP_SSID);
  }

  // 5. Daftarkan Rute Web Server
  httpServer.on("/", handleSettingPage);
  httpServer.on("/setting", handleSettingPage);
  httpServer.on("/api/status", handleApiStatus);
  httpServer.on("/api/wifi-save", HTTP_POST, handleSaveWifi);
  httpServer.on("/api/client-disconnect", HTTP_POST, handleDisconnectClient);
  httpServer.on("/api/client-disconnect-all", HTTP_POST, handleDisconnectAllClients);
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

  // Wi-Fi selalu dicoba ulang, termasuk ketika AP setup sedang aktif.
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiWasConnected) {
      wifiWasConnected = false;
      wifiDisconnectedSince = millis();
      if (mdnsStarted) {
        MDNS.end();
        mdnsStarted = false;
      }
      Serial.println("[Wi-Fi] Sinyal terputus! Mencoba reconnect...");
    }

    unsigned long currentMillis = millis();
    if (currentMillis - lastWiFiRetry >= wifiRetryInterval) {
      lastWiFiRetry = currentMillis;
      WiFi.reconnect();
    }
    if (!isApMode && wifiDisconnectedSince != 0 && currentMillis - wifiDisconnectedSince >= wifiFallbackDelay) {
      Serial.println("[Wi-Fi] Belum pulih setelah 30 detik. Mengaktifkan Hotspot Setup.");
      startSetupAccessPoint();
    }
  } else if (!wifiWasConnected || isApMode) {
    handleStationConnected();
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

      broadcastMachineStatus("M1", m1_active, durasi);
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

      broadcastMachineStatus("M2", m2_active, durasi);
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

      broadcastMachineStatus("M3", m3_active, durasi);
    }
  }

  delay(10);
}
