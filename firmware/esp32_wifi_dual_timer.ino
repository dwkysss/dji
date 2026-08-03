/*
 * ==================================================================================
 * ESP32 DUAL MACHINE TIMER FIRMWARE (Wi-Fi WebSocket & mDNS)
 * ==================================================================================
 * Deskripsi:
 * Firmware ESP32 untuk memantau 2 Mesin sekaligus secara real-time via Wi-Fi Lokal.
 * 
 * Fitur:
 * 1. WebSocketsServer di Port 81 (Real-time Broadcast Event status mesin).
 * 2. WebServer HTTP di Port 80 (/api/status untuk REST check).
 * 3. mDNS Server: http://esp32-timer.local
 * 4. Dual Machine Monitoring dengan Software Debounce 500ms:
 *    - Mesin 1 (M1): GPIO 4 (INPUT_PULLUP, Aktif LOW = START, HIGH = STOP)
 *    - Mesin 2 (M2): GPIO 5 (INPUT_PULLUP, Aktif LOW = START, HIGH = STOP)
 *    - Ground Bersama (Common Ground ke kontak COM relay/sakelar)
 * 
 * Format Payload WebSocket JSON:
 * - {"machine":"M1","status":"START"} atau {"machine":"M1","status":"STOP"}
 * - {"machine":"M2","status":"START"} atau {"machine":"M2","status":"STOP"}
 * 
 * Library Dependencies (Install via Arduino Library Manager):
 * - WebSockets by Markus Sattler (v2.3.0+)
 * - Built-in ESP32 libraries: WiFi.h, ESPmDNS.h, WebServer.h
 * ==================================================================================
 */

#include <WiFi.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <WebSocketsServer.h>

// ----------------------------------------------------------------------------------
// KONFIGURASI WI-FI (Sesuaikan SSID & Password Wi-Fi Lokal Anda)
// ----------------------------------------------------------------------------------
const char* WIFI_SSID     = "DJI_PRODUCTION_NET";
const char* WIFI_PASSWORD = "production123";

// Hostname mDNS -> http://esp32-timer.local
const char* MDNS_HOSTNAME = "esp32-timer";

// ----------------------------------------------------------------------------------
// KONFIGURASI HARDWARE GPIO
// ----------------------------------------------------------------------------------
const int PIN_M1 = 4; // GPIO 4 untuk Sakelar/Relay Mesin 1
const int PIN_M2 = 5; // GPIO 5 untuk Sakelar/Relay Mesin 2

// Timing Software Debounce (500ms)
const unsigned long DEBOUNCE_DELAY = 500;

// State Tracking Mesin 1 & Mesin 2 (Initial LOW / HIGH)
int lastPinStateM1 = HIGH;
int currentPinStateM1 = HIGH;
unsigned long lastDebounceTimeM1 = 0;

int lastPinStateM2 = HIGH;
int currentPinStateM2 = HIGH;
unsigned long lastDebounceTimeM2 = 0;

// ----------------------------------------------------------------------------------
// INSTANSISASI SERVER
// ----------------------------------------------------------------------------------
WebServer server(80);           // HTTP REST API di Port 80
WebSocketsServer webSocket(81); // WebSocket Server di Port 81

// ----------------------------------------------------------------------------------
// HELPER BROADCAST WEBSOCKET
// ----------------------------------------------------------------------------------
void sendMachineEvent(const char* machine, const char* status) {
  String json = "{\"machine\":\"";
  json += machine;
  json += "\",\"status\":\"";
  json += status;
  json += "\"}";

  webSocket.broadcastTXT(json);
  Serial.print("[WebSocket Broadcast] ");
  Serial.println(json);
}

// ----------------------------------------------------------------------------------
// WEBSOCKET EVENT HANDLER
// ----------------------------------------------------------------------------------
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("[WebSocket] Client #%u Terputus\n", num);
      break;

    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf("[WebSocket] Client #%u Terhubung dari IP %d.%d.%d.%d\n", num, ip[0], ip[1], ip[2], ip[3]);
      
      // Send initial status payload for both machines upon connection
      String statusM1Str = (currentPinStateM1 == LOW) ? "START" : "STOP";
      String statusM2Str = (currentPinStateM2 == LOW) ? "START" : "STOP";
      
      String initM1 = "{\"machine\":\"M1\",\"status\":\"" + statusM1Str + "\"}";
      String initM2 = "{\"machine\":\"M2\",\"status\":\"" + statusM2Str + "\"}";
      
      webSocket.sendTXT(num, initM1);
      webSocket.sendTXT(num, initM2);
      break;
    }

    case WStype_TEXT:
      Serial.printf("[WebSocket] Client #%u Pesan: %s\n", num, payload);
      // Optional ping/pong handler or manual command trigger from web client
      if (strcmp((char*)payload, "GET_STATUS") == 0) {
        String statusM1Str = (currentPinStateM1 == LOW) ? "START" : "STOP";
        String statusM2Str = (currentPinStateM2 == LOW) ? "START" : "STOP";
        webSocket.sendTXT(num, "{\"machine\":\"M1\",\"status\":\"" + statusM1Str + "\"}");
        webSocket.sendTXT(num, "{\"machine\":\"M2\",\"status\":\"" + statusM2Str + "\"}");
      }
      break;

    default:
      break;
  }
}

// ----------------------------------------------------------------------------------
// HTTP REST API HANDLERS (Port 80)
// ----------------------------------------------------------------------------------
void handleApiStatus() {
  String statusM1 = (currentPinStateM1 == LOW) ? "START" : "STOP";
  String statusM2 = (currentPinStateM2 == LOW) ? "START" : "STOP";

  String json = "{";
  json += "\"status\":\"OK\",";
  json += "\"mdns\":\"http://esp32-timer.local\",";
  json += "\"websocket_port\":81,";
  json += "\"machines\":{";
  json += "\"M1\":{\"gpio\":4,\"status\":\"" + statusM1 + "\"},";
  json += "\"M2\":{\"gpio\":5,\"status\":\"" + statusM2 + "\"}";
  json += "}}";

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

void handleNotFound() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(404, "text/plain", "404 Not Found - Use /api/status or WebSocket Port 81");
}

// ----------------------------------------------------------------------------------
// SETUP
// ----------------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n=== INTIASI ESP32 DUAL MACHINE TIMER ===");

  // 1. Inisialisasi GPIO Pin dengan Internal INPUT_PULLUP
  pinMode(PIN_M1, INPUT_PULLUP);
  pinMode(PIN_M2, INPUT_PULLUP);

  currentPinStateM1 = digitalRead(PIN_M1);
  lastPinStateM1    = currentPinStateM1;

  currentPinStateM2 = digitalRead(PIN_M2);
  lastPinStateM2    = currentPinStateM2;

  // 2. Koneksi Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Menghubungkan ke Wi-Fi: ");
  Serial.println(WIFI_SSID);

  int wifiRetries = 0;
  while (WiFi.status() != WL_CONNECTED && wifiRetries < 20) {
    delay(500);
    Serial.print(".");
    wifiRetries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[Wi-Fi] Terhubung!");
    Serial.print("[Wi-Fi] IP Address ESP32: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[Wi-Fi] Gagal terhubung (Timeout). Menjalankan mode AP/Standby.");
  }

  // 3. Inisialisasi mDNS Server (esp32-timer.local)
  if (MDNS.begin(MDNS_HOSTNAME)) {
    Serial.printf("[mDNS] Server mDNS Berhasil Aktif: http://%s.local\n", MDNS_HOSTNAME);
    MDNS.addService("http", "tcp", 80);
    MDNS.addService("ws", "tcp", 81);
  } else {
    Serial.println("[mDNS] Gagal memulai mDNS Server!");
  }

  // 4. Start WebSocket Server di Port 81
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  Serial.println("[WebSocket] Server Aktif di Port 81");

  // 5. Start HTTP Server di Port 80
  server.on("/api/status", HTTP_GET, handleApiStatus);
  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println("[HTTP API] Server REST Aktif di Port 80 (/api/status)");

  Serial.println("==================================================");
  Serial.println("Sistem Pemantau Dual Mesin Siap Beroperasi!");
  Serial.println("==================================================");
}

// ----------------------------------------------------------------------------------
// MAIN LOOP & DEBOUNCE MONITORING
// ----------------------------------------------------------------------------------
void loop() {
  // Handler WebSocket & WebServer
  webSocket.loop();
  server.handleClient();

  unsigned long now = millis();

  // --------------------------------------------------------------------------------
  // MONITORING MESIN 1 (GPIO 4) dengan 500ms Software Debounce
  // --------------------------------------------------------------------------------
  int readingM1 = digitalRead(PIN_M1);
  if (readingM1 != lastPinStateM1) {
    lastDebounceTimeM1 = now;
    lastPinStateM1 = readingM1;
  }

  if ((now - lastDebounceTimeM1) > DEBOUNCE_DELAY) {
    if (readingM1 != currentPinStateM1) {
      currentPinStateM1 = readingM1;
      // LOW = Sakelar tertutup/terhubung ke GND -> MESIN START
      // HIGH = Sakelar terbuka -> MESIN STOP
      if (currentPinStateM1 == LOW) {
        sendMachineEvent("M1", "START");
      } else {
        sendMachineEvent("M1", "STOP");
      }
    }
  }

  // --------------------------------------------------------------------------------
  // MONITORING MESIN 2 (GPIO 5) dengan 500ms Software Debounce
  // --------------------------------------------------------------------------------
  int readingM2 = digitalRead(PIN_M2);
  if (readingM2 != lastPinStateM2) {
    lastDebounceTimeM2 = now;
    lastPinStateM2 = readingM2;
  }

  if ((now - lastDebounceTimeM2) > DEBOUNCE_DELAY) {
    if (readingM2 != currentPinStateM2) {
      currentPinStateM2 = readingM2;
      // LOW = Sakelar tertutup/terhubung ke GND -> MESIN START
      // HIGH = Sakelar terbuka -> MESIN STOP
      if (currentPinStateM2 == LOW) {
        sendMachineEvent("M2", "START");
      } else {
        sendMachineEvent("M2", "STOP");
      }
    }
  }
}
