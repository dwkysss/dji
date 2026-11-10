#pragma once

// Salin file ini menjadi secrets.h, lalu ganti nilainya sebelum firmware di-flash.
// Jangan commit secrets.h karena berisi kredensial perangkat.
#define PORTAL_ADMIN_USER "admin"
#define PORTAL_ADMIN_PASSWORD "ganti-dengan-password-admin-yang-panjang"

// Dipakai hanya saat NVS ESP32 belum pernah dikonfigurasi.
#define DEFAULT_WIFI_SSID "ganti-dengan-ssid-pabrik"
#define DEFAULT_WIFI_PASSWORD "ganti-dengan-password-wifi-pabrik"

// Hotspot sementara untuk konfigurasi saat Wi-Fi pabrik tidak tersedia.
#define SETUP_AP_SSID "DJI-TIMER-SETUP"
#define SETUP_AP_PASSWORD "ganti-dengan-password-hotspot-yang-kuat"
