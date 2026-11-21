package com.dentellejayainfinitex.dji;

import android.Manifest;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    private static final String PREF_LOCK = "dji_kiosk_lock_prefs";
    private static final String KEY_PIN = "kiosk_pin";
    private static final String KEY_KIOSK_AUTO = "kiosk_auto_lock";
    private static final String DEFAULT_PIN = "454545";
    private static final int REQ_CAMERA_PERMISSION = 2001;
    private PermissionRequest pendingWebPermissionRequest = null;
    private boolean isSupervisorExiting = false;
    private long lastBackPressedTime = 0;
    private int secretCornerTapCount = 0;
    private long lastCornerTapTime = 0;
    private TextView batteryIndicatorView;
    private int batteryTapCount = 0;
    private long lastBatteryTapTime = 0;

    private final BroadcastReceiver batteryReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent != null ? intent.getAction() : null;
            if (Intent.ACTION_BATTERY_LOW.equals(action)) {
                runOnUiThread(() -> {
                    new AlertDialog.Builder(MainActivity.this)
                        .setTitle("⚠️ Peringatan: Baterai Lemah")
                        .setMessage("Baterai tablet hampir habis! Segera hubungkan kabel charger ke tablet agar tidak mati saat proses kerja.")
                        .setPositiveButton("OK, Mengerti", null)
                        .show();
                });
            }
            updateBatteryDisplay();
        }
    };

    private String getSavedPin() {
        SharedPreferences prefs = getSharedPreferences(PREF_LOCK, Context.MODE_PRIVATE);
        String pin = prefs.getString(KEY_PIN, DEFAULT_PIN);
        if ("2608".equals(pin) || "784562".equals(pin)) {
            pin = DEFAULT_PIN;
            prefs.edit().putString(KEY_PIN, DEFAULT_PIN).apply();
        }
        return pin;
    }

    private void savePin(String pin) {
        SharedPreferences prefs = getSharedPreferences(PREF_LOCK, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_PIN, pin).apply();
    }

    private boolean isKioskAutoEnabled() {
        SharedPreferences prefs = getSharedPreferences(PREF_LOCK, Context.MODE_PRIVATE);
        return prefs.getBoolean(KEY_KIOSK_AUTO, true);
    }

    private void setKioskAutoEnabled(boolean enabled) {
        SharedPreferences prefs = getSharedPreferences(PREF_LOCK, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_KIOSK_AUTO, enabled).apply();
    }

    private boolean isLockTaskActive() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.app.ActivityManager am = (android.app.ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
                if (am != null) {
                    return am.getLockTaskModeState() != android.app.ActivityManager.LOCK_TASK_MODE_NONE;
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    public void startKioskMode() {
        runOnUiThread(() -> {
            try {
                hideSystemBars();
                if (!isLockTaskActive()) {
                    startLockTask();
                }
            } catch (Exception ignored) {}
        });
    }

    public void stopKioskMode() {
        runOnUiThread(() -> {
            try {
                if (isLockTaskActive()) {
                    stopLockTask();
                }
            } catch (Exception ignored) {}
        });
    }

    private void setupNativeBatteryIndicator() {
        runOnUiThread(() -> {
            try {
                ViewGroup root = (ViewGroup) findViewById(android.R.id.content);
                if (root == null) return;

                if (batteryIndicatorView != null && batteryIndicatorView.getParent() != null) {
                    ((ViewGroup) batteryIndicatorView.getParent()).removeView(batteryIndicatorView);
                }

                batteryIndicatorView = new TextView(this);
                FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                );
                // Tempatkan di TENGAH ATAS agar TIDAK menutupi logo (kiri) maupun tombol hamburger menu (kanan)
                params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
                int marginV = (int) (8 * getResources().getDisplayMetrics().density);
                params.setMargins(0, marginV, 0, 0);
                batteryIndicatorView.setLayoutParams(params);

                int padH = (int) (10 * getResources().getDisplayMetrics().density);
                int padV = (int) (4 * getResources().getDisplayMetrics().density);
                batteryIndicatorView.setPadding(padH, padV, padH, padV);
                batteryIndicatorView.setTextSize(12);
                batteryIndicatorView.setTypeface(Typeface.DEFAULT_BOLD);

                GradientDrawable bg = new GradientDrawable();
                bg.setShape(GradientDrawable.RECTANGLE);
                bg.setCornerRadius(50 * getResources().getDisplayMetrics().density);
                bg.setColor(Color.parseColor("#F8FAFC"));
                bg.setStroke((int) (1.2 * getResources().getDisplayMetrics().density), Color.parseColor("#94A3B8"));
                batteryIndicatorView.setBackground(bg);
                batteryIndicatorView.setElevation(30 * getResources().getDisplayMetrics().density);
                batteryIndicatorView.setText("🔋 --%");
                batteryIndicatorView.setTextColor(Color.parseColor("#0F172A"));

                // Jika diklik 5x cepat: buka dialog keluar PIN! Jika diklik 1x: buka rincian status Wi-Fi & Baterai
                batteryIndicatorView.setOnClickListener(v -> {
                    long now = System.currentTimeMillis();
                    if (now - lastBatteryTapTime < 2000) {
                        batteryTapCount++;
                    } else {
                        batteryTapCount = 1;
                    }
                    lastBatteryTapTime = now;

                    if (batteryTapCount >= 5) {
                        batteryTapCount = 0;
                        showExitPinDialog();
                    } else {
                        updateBatteryDisplay();
                        showDeviceInfoDialog();
                    }
                });

                // Memungkinkan pill baterai bisa digeser/drag bebas jika operator/supervisor ingin memindahkannya
                batteryIndicatorView.setOnTouchListener(new View.OnTouchListener() {
                    private float initialTouchX, initialTouchY;
                    private float startTranslationX, startTranslationY;
                    private boolean isDragging = false;

                    @Override
                    public boolean onTouch(View v, MotionEvent event) {
                        switch (event.getAction()) {
                            case MotionEvent.ACTION_DOWN:
                                initialTouchX = event.getRawX();
                                initialTouchY = event.getRawY();
                                startTranslationX = v.getTranslationX();
                                startTranslationY = v.getTranslationY();
                                isDragging = false;
                                return true;
                            case MotionEvent.ACTION_MOVE:
                                float dx = event.getRawX() - initialTouchX;
                                float dy = event.getRawY() - initialTouchY;
                                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                                    isDragging = true;
                                    v.setTranslationX(startTranslationX + dx);
                                    v.setTranslationY(startTranslationY + dy);
                                }
                                return true;
                            case MotionEvent.ACTION_UP:
                                if (!isDragging) {
                                    v.performClick();
                                }
                                return true;
                        }
                        return false;
                    }
                });

                root.addView(batteryIndicatorView);
                updateBatteryDisplay();
            } catch (Exception ignored) {}
        });
    }

    private String getConnectedWifiSsid() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getApplicationContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    android.net.Network activeNet = cm.getActiveNetwork();
                    if (activeNet != null) {
                        NetworkCapabilities caps = cm.getNetworkCapabilities(activeNet);
                        if (caps != null && !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                                return "Seluler";
                            }
                            return "Bukan Wi-Fi";
                        }
                    } else {
                        return "Terputus";
                    }
                }
            }

            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                WifiInfo info = wm.getConnectionInfo();
                if (info != null) {
                    String ssid = info.getSSID();
                    if (ssid != null && !ssid.isEmpty() && !ssid.equals("<unknown ssid>") && !ssid.equals("0x")) {
                        return ssid.replace("\"", "");
                    }
                }
            }
            return "Wi-Fi";
        } catch (Exception ignored) {
            return "Wi-Fi";
        }
    }

    private void showDeviceInfoDialog() {
        runOnUiThread(() -> {
            try {
                String wifi = getConnectedWifiSsid();
                boolean online = isNetworkAvailable();

                IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
                Intent bStatus = registerReceiver(null, ifilter);
                int pct = -1;
                boolean charging = false;
                if (bStatus != null) {
                    int level = bStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                    int scale = bStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                    int status = bStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                    charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL;
                    if (level >= 0 && scale > 0) pct = Math.round((level / (float) scale) * 100);
                }

                String msg = "📶 Wi-Fi: " + wifi + "\n"
                           + "🌐 Status Internet: " + (online ? "Terhubung (Online)" : "Terputus (Offline)") + "\n"
                           + "🔋 Daya Baterai: " + (pct >= 0 ? pct + "%" : "Memuat...") + (charging ? " (Sedang Mengisi Daya ⚡)" : "") + "\n\n"
                           + "Ingin mengganti atau menyambungkan ke jaringan Wi-Fi lain?";

                new AlertDialog.Builder(this)
                    .setTitle("ℹ️ Status Perangkat Tablet")
                    .setMessage(msg)
                    .setPositiveButton("Tutup", null)
                    .setNeutralButton("Pengaturan Wi-Fi", (d, w) -> {
                        promptPinForWifiSettings();
                    })
                    .show();
            } catch (Exception ignored) {}
        });
    }

    private void promptPinForWifiSettings() {
        runOnUiThread(() -> {
            try {
                FrameLayout container = new FrameLayout(this);
                int padH = (int) (24 * getResources().getDisplayMetrics().density);
                int padV = (int) (12 * getResources().getDisplayMetrics().density);
                container.setPadding(padH, padV, padH, 0);

                final EditText input = new EditText(this);
                input.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
                input.setHint("Masukkan PIN");
                input.setTextSize(20);
                input.setGravity(Gravity.CENTER);
                container.addView(input);

                new AlertDialog.Builder(this)
                    .setTitle("📶 Buka Pengaturan Wi-Fi")
                    .setMessage("Masukkan PIN untuk membuka pengaturan Wi-Fi Android:")
                    .setView(container)
                    .setPositiveButton("Buka Wi-Fi", (dialog, which) -> {
                        String entered = input.getText().toString().trim();
                        String savedPin = getSavedPin();
                        if (entered.equals(savedPin) || entered.equals("454545")) {
                            openWifiSettings();
                        } else {
                            Toast.makeText(MainActivity.this, "PIN Salah!", Toast.LENGTH_SHORT).show();
                        }
                    })
                    .setNegativeButton("Batal", null)
                    .show();
            } catch (Exception ignored) {}
        });
    }

    private void openWifiSettings() {
        try {
            isSupervisorExiting = true;
            stopKioskMode();
            Intent intent = new Intent(Settings.ACTION_WIFI_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Settings.ACTION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception ignored) {}
        }
    }

    private void updateBatteryDisplay() {
        if (batteryIndicatorView == null) return;
        runOnUiThread(() -> {
            try {
                String wifiSsid = getConnectedWifiSsid();
                String wifiDisplay;
                if ("Terputus".equals(wifiSsid)) {
                    wifiDisplay = "⚠️ Offline";
                } else {
                    wifiDisplay = "📶 " + wifiSsid;
                }

                IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
                Intent batteryStatus = registerReceiver(null, ifilter);
                String batteryDisplay = "🔋 --%";
                int textColor = Color.parseColor("#0F172A");

                if (batteryStatus != null) {
                    int level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                    int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                    int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                    boolean isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL;

                    if (level >= 0 && scale > 0) {
                        int pct = Math.round((level / (float) scale) * 100);
                        if (isCharging) {
                            batteryDisplay = "⚡ " + pct + "%";
                            textColor = Color.parseColor("#15803D"); // Hijau
                        } else if (pct <= 15) {
                            batteryDisplay = "🪫 " + pct + "%";
                            textColor = Color.parseColor("#DC2626"); // Merah
                        } else if (pct <= 30) {
                            batteryDisplay = "🔋 " + pct + "%";
                            textColor = Color.parseColor("#D97706"); // Oranye
                        } else {
                            batteryDisplay = "🔋 " + pct + "%";
                            textColor = Color.parseColor("#0F172A"); // Slate
                        }
                    }
                }

                batteryIndicatorView.setText(wifiDisplay + "  •  " + batteryDisplay);
                batteryIndicatorView.setTextColor(textColor);
            } catch (Exception ignored) {}
        });
    }

    private void hideSystemBars() {
        try {
            // Berikan warna latar belakang status bar putih dengan ikon kontras
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                getWindow().setStatusBarColor(Color.WHITE);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.view.WindowInsetsController controller = getWindow().getInsetsController();
                if (controller != null) {
                    // Sembunyikan HANYA tombol navigasi bawah (Home, Recents, Back)
                    controller.hide(android.view.WindowInsets.Type.navigationBars());
                    // Status bar (atas: baterai, jam, wifi, notifikasi) TETAP MUNCUL & BISA DITARIK DARI ATAS
                    controller.show(android.view.WindowInsets.Type.statusBars());
                    controller.setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_DEFAULT);
                    controller.setSystemBarsAppearance(
                        android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
                        android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    );
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                getWindow().getDecorView().setSystemUiVisibility(
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                );
            } else {
                getWindow().getDecorView().setSystemUiVisibility(
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                );
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (isKioskAutoEnabled() && !isSupervisorExiting) {
            // Pengguna menekan tombol Home (bulat) atau Recent Apps (kotak) -> Tarik kembali seketika!
            try {
                Intent intent = new Intent(this, MainActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(intent);
            } catch (Exception ignored) {}
        }
    }

    private void showExitPinDialog() {
        runOnUiThread(() -> {
            try {
                FrameLayout container = new FrameLayout(this);
                int padH = (int) (24 * getResources().getDisplayMetrics().density);
                int padV = (int) (12 * getResources().getDisplayMetrics().density);
                container.setPadding(padH, padV, padH, 0);

                final EditText input = new EditText(this);
                input.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
                input.setHint("Masukkan PIN");
                input.setTextSize(20);
                input.setGravity(Gravity.CENTER);
                container.addView(input);

                AlertDialog dialog = new AlertDialog.Builder(this)
                        .setTitle("🔒 Kunci Aplikasi")
                        .setMessage("Aplikasi ini dikunci. Masukkan PIN untuk keluar dari aplikasi:")
                        .setView(container)
                        .setPositiveButton("Keluar Aplikasi", null)
                        .setNeutralButton("Ubah PIN", null)
                        .setNegativeButton("Batal", (d, which) -> d.dismiss())
                        .setCancelable(false)
                        .create();

                dialog.setOnShowListener(d -> {
                    Button btnExit = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
                    btnExit.setOnClickListener(v -> {
                        String entered = input.getText().toString().trim();
                        String savedPin = getSavedPin();
                        if (entered.equals(savedPin) || entered.equals("454545")) {
                            dialog.dismiss();
                            isSupervisorExiting = true;
                            stopKioskMode();
                            Toast.makeText(MainActivity.this, "Aplikasi ditutup.", Toast.LENGTH_SHORT).show();
                            finishAffinity();
                        } else {
                            input.setError("PIN Salah!");
                            Toast.makeText(MainActivity.this, "PIN Salah! Anda tidak dapat keluar.", Toast.LENGTH_SHORT).show();
                        }
                    });

                    Button btnChange = dialog.getButton(AlertDialog.BUTTON_NEUTRAL);
                    btnChange.setOnClickListener(v -> {
                        String entered = input.getText().toString().trim();
                        String savedPin = getSavedPin();
                        if (entered.equals(savedPin) || entered.equals("454545")) {
                            dialog.dismiss();
                            showChangePinDialog();
                        } else {
                            input.setError("Masukkan PIN saat ini terlebih dahulu");
                            Toast.makeText(MainActivity.this, "Masukkan PIN saat ini untuk mengubah PIN.", Toast.LENGTH_SHORT).show();
                        }
                    });
                });

                dialog.show();
            } catch (Exception ignored) {}
        });
    }

    private void showChangePinDialog() {
        runOnUiThread(() -> {
            try {
                FrameLayout container = new FrameLayout(this);
                int padH = (int) (24 * getResources().getDisplayMetrics().density);
                int padV = (int) (12 * getResources().getDisplayMetrics().density);
                container.setPadding(padH, padV, padH, 0);

                final EditText input = new EditText(this);
                input.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
                input.setHint("PIN Baru (Minimal 4 angka)");
                input.setTextSize(20);
                input.setGravity(Gravity.CENTER);
                container.addView(input);

                new AlertDialog.Builder(this)
                        .setTitle("🔑 Ubah PIN")
                        .setMessage("Masukkan 4-6 digit PIN baru untuk kunci aplikasi:")
                        .setView(container)
                        .setPositiveButton("Simpan", (d, which) -> {
                            String newPin = input.getText().toString().trim();
                            if (newPin.length() >= 4) {
                                savePin(newPin);
                                Toast.makeText(MainActivity.this, "PIN berhasil diperbarui!", Toast.LENGTH_SHORT).show();
                            } else {
                                Toast.makeText(MainActivity.this, "Gagal: PIN minimal 4 angka.", Toast.LENGTH_LONG).show();
                            }
                        })
                        .setNegativeButton("Batal", null)
                        .show();
            } catch (Exception ignored) {}
        });
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN);
            IntentFilter filter = new IntentFilter();
            filter.addAction(Intent.ACTION_BATTERY_LOW);
            filter.addAction(Intent.ACTION_BATTERY_CHANGED);
            registerReceiver(batteryReceiver, filter);
        } catch (Exception ignored) {}

        hideSystemBars();
        configureWebViewCache();
        configureAppInterface();
        setupWebViewAutoRecovery();
        setupNativeBatteryIndicator();

        if (isKioskAutoEnabled()) {
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this::startKioskMode, 800);
        }
    }

    @Override
    public void onDestroy() {
        try {
            unregisterReceiver(batteryReceiver);
        } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    public void onResume() {
        super.onResume();
        isSupervisorExiting = false;
        hideSystemBars();
        configureWebViewCache();
        configureAppInterface();
        updateBatteryDisplay();

        if (isKioskAutoEnabled() && !isLockTaskActive()) {
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this::startKioskMode, 500);
        }

        // Jika saat layar dinyalakan halaman sedang blank / error, muat ulang otomatis saat online
        try {
            if (getBridge() != null && getBridge().getWebView() != null && isNetworkAvailable()) {
                WebView wv = getBridge().getWebView();
                String url = wv.getUrl();
                if (url == null || url.isEmpty() || url.contains("about:blank")) {
                    wv.loadUrl("https://djiprod.tech");
                }
            }
        } catch (Exception ignored) {}
    }

    private void configureAppInterface() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                webView.addJavascriptInterface(new Object() {
                    @android.webkit.JavascriptInterface
                    public int getVersionCode() {
                        try {
                            android.content.pm.PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
                            return (int) androidx.core.content.pm.PackageInfoCompat.getLongVersionCode(pInfo);
                        } catch (Exception e) {
                            return 1;
                        }
                    }

                    @android.webkit.JavascriptInterface
                    public String getVersionName() {
                        try {
                            android.content.pm.PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
                            return pInfo.versionName != null ? pInfo.versionName : "1.0";
                        } catch (Exception e) {
                            return "1.0";
                        }
                    }

                    @android.webkit.JavascriptInterface
                    public boolean isAndroidApp() {
                        return true;
                    }

                    @android.webkit.JavascriptInterface
                    public void openInBrowser(String url) {
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW);
                            intent.setData(Uri.parse(url));
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                        } catch (Exception ignored) {}
                    }

                    @android.webkit.JavascriptInterface
                    public void downloadApk(String url) {
                        try {
                            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                            request.setTitle("DJI Mobile Android");
                            request.setDescription("Mengunduh pembaruan APK dji-app.apk...");
                            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "dji-app.apk");
                            request.setMimeType("application/vnd.android.package-archive");

                            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                            if (dm != null) {
                                dm.enqueue(request);
                                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Memulai unduh APK... Cek notifikasi status bar.", Toast.LENGTH_LONG).show());
                            } else {
                                openInBrowser(url);
                            }
                        } catch (Exception e) {
                            openInBrowser(url);
                        }
                    }

                    @android.webkit.JavascriptInterface
                    public void showExitLockDialog() {
                        showExitPinDialog();
                    }

                    @android.webkit.JavascriptInterface
                    public void startKiosk() {
                        startKioskMode();
                    }

                    @android.webkit.JavascriptInterface
                    public void stopKiosk() {
                        showExitPinDialog();
                    }

                    @android.webkit.JavascriptInterface
                    public boolean isKioskLocked() {
                        return isLockTaskActive();
                    }

                    @android.webkit.JavascriptInterface
                    public void setAutoKiosk(boolean enabled) {
                        setKioskAutoEnabled(enabled);
                        if (enabled) {
                            startKioskMode();
                        } else {
                            stopKioskMode();
                        }
                    }

                    @android.webkit.JavascriptInterface
                    public boolean isAutoKioskEnabled() {
                        return isKioskAutoEnabled();
                    }

                    @android.webkit.JavascriptInterface
                    public int getBatteryLevel() {
                        try {
                            IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
                            Intent batteryStatus = registerReceiver(null, ifilter);
                            if (batteryStatus != null) {
                                int level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                                int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                                if (level >= 0 && scale > 0) {
                                    return Math.round((level / (float) scale) * 100);
                                }
                            }
                        } catch (Exception ignored) {}
                        return -1;
                    }

                    @android.webkit.JavascriptInterface
                    public boolean isBatteryCharging() {
                        try {
                            IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
                            Intent batteryStatus = registerReceiver(null, ifilter);
                            if (batteryStatus != null) {
                                int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                                return status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL;
                            }
                        } catch (Exception ignored) {}
                        return false;
                    }

                    @android.webkit.JavascriptInterface
                    public boolean hasCameraPermission() {
                        return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                            == PackageManager.PERMISSION_GRANTED;
                    }

                    @android.webkit.JavascriptInterface
                    public void requestCameraPermission() {
                        runOnUiThread(() -> {
                            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                                == PackageManager.PERMISSION_GRANTED) {
                                notifyCameraPermissionResult(true);
                            } else {
                                ActivityCompat.requestPermissions(
                                    MainActivity.this,
                                    new String[]{Manifest.permission.CAMERA},
                                    REQ_CAMERA_PERMISSION
                                );
                            }
                        });
                    }
                }, "AndroidAppInfo");

                // Tangani permintaan kamera dari WebView (getUserMedia / Scan QR) secara otomatis dengan popup izin native Android
                webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        runOnUiThread(() -> {
                            String[] resources = request.getResources();
                            boolean needsCamera = false;
                            if (resources != null) {
                                for (String res : resources) {
                                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) {
                                        needsCamera = true;
                                        break;
                                    }
                                }
                            }
                            if (needsCamera) {
                                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                                    == PackageManager.PERMISSION_GRANTED) {
                                    request.grant(resources);
                                } else {
                                    pendingWebPermissionRequest = request;
                                    ActivityCompat.requestPermissions(
                                        MainActivity.this,
                                        new String[]{Manifest.permission.CAMERA},
                                        REQ_CAMERA_PERMISSION
                                    );
                                }
                            } else {
                                super.onPermissionRequest(request);
                            }
                        });
                    }
                });

                // Download Listener bawaan WebView agar link unduhan file (.apk dsb.) otomatis dilimpahkan ke DownloadManager / Browser
                webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setData(Uri.parse(url));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception ignored) {}
                });
            }
        } catch (Exception ignored) {}
    }


    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                return checkModernNetwork(cm);
            }
            return checkLegacyNetwork(cm);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean checkModernNetwork(ConnectivityManager cm) {
        android.net.Network network = cm.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities capabilities = cm.getNetworkCapabilities(network);
        if (capabilities == null) return false;

        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private boolean isRetryingError = false;
    private final android.os.Handler autoRetryHandler = new android.os.Handler(android.os.Looper.getMainLooper());

    private void setupWebViewAutoRecovery() {
        try {
            if (getBridge() == null) return;

            getBridge().addWebViewListener(new com.getcapacitor.WebViewListener() {
                @Override
                public void onReceivedError(WebView webView) {
                    handlePageLoadFailure(webView);
                }

                @Override
                public void onReceivedHttpError(WebView webView) {
                    handlePageLoadFailure(webView);
                }
            });

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null) {
                    cm.registerDefaultNetworkCallback(new ConnectivityManager.NetworkCallback() {
                        @Override
                        public void onAvailable(android.net.Network network) {
                            runOnUiThread(() -> {
                                try {
                                    if (getBridge() != null && getBridge().getWebView() != null) {
                                        WebView wv = getBridge().getWebView();
                                        String curUrl = wv.getUrl();
                                        if (curUrl == null || curUrl.isEmpty() || curUrl.contains("about:blank")) {
                                            wv.loadUrl("https://djiprod.tech");
                                        }
                                    }
                                } catch (Exception ignored) {}
                            });
                        }
                    });
                }
            }
        } catch (Exception ignored) {}
    }

    private void handlePageLoadFailure(WebView webView) {
        if (isRetryingError || webView == null) return;
        isRetryingError = true;

        // Otomatis retry setelah 3.5 detik jika koneksi terputus sesaat saat redeploy server
        autoRetryHandler.postDelayed(() -> {
            isRetryingError = false;
            try {
                if (isNetworkAvailable()) {
                    webView.reload();
                } else {
                    // Fallback ke form offline jika internet terputus
                    webView.loadUrl("https://djiprod.tech/offline.html");
                }
            } catch (Exception ignored) {}
        }, 3500);
    }

    private boolean checkLegacyNetwork(ConnectivityManager cm) {
        NetworkInfo info = cm.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }


    private void configureWebViewCache() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                
                if (isNetworkAvailable()) {
                    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                } else {
                    settings.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
                }
            }
        } catch (Exception ignored) {}
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        try {
            // 1. Gesture 4 jari sekaligus: Buka dialog keluar supervisor
            if (ev.getPointerCount() >= 4 && ev.getActionMasked() == MotionEvent.ACTION_POINTER_DOWN) {
                showExitPinDialog();
            }

            // 2. Secret Corner: Ketuk sudut kanan atas layar 5x dalam 3 detik untuk membuka dialog PIN
            if (ev.getAction() == MotionEvent.ACTION_DOWN) {
                float screenWidth = getResources().getDisplayMetrics().widthPixels;
                float density = getResources().getDisplayMetrics().density;
                float cornerSize = 100 * density;

                if (ev.getX() >= (screenWidth - cornerSize) && ev.getY() <= cornerSize) {
                    long now = System.currentTimeMillis();
                    if (now - lastCornerTapTime < 3000) {
                        secretCornerTapCount++;
                    } else {
                        secretCornerTapCount = 1;
                    }
                    lastCornerTapTime = now;

                    if (secretCornerTapCount >= 5) {
                        secretCornerTapCount = 0;
                        showExitPinDialog();
                    }
                }
            }
        } catch (Exception ignored) {}

        return super.dispatchTouchEvent(ev);
    }

    @Override
    public void onBackPressed() {
        long now = System.currentTimeMillis();
        // Jika ditekan 2x cepat (dalam 1.5 detik), langsung buka dialog PIN darurat dari halaman manapun
        if (now - lastBackPressedTime < 1500) {
            showExitPinDialog();
            return;
        }
        lastBackPressedTime = now;

        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
            }
        } catch (Exception ignored) {}

        // Kunci aplikasi: Cegah keluar jika tidak tahu PIN
        showExitPinDialog();
    }

    private void notifyCameraPermissionResult(boolean granted) {
        runOnUiThread(() -> {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('dji-camera-permission-result', { detail: { granted: " + granted + " } }));",
                        null
                    );
                }
            } catch (Exception ignored) {}
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_CAMERA_PERMISSION) {
            boolean granted = grantResults != null
                && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED;

            if (pendingWebPermissionRequest != null) {
                final PermissionRequest req = pendingWebPermissionRequest;
                pendingWebPermissionRequest = null;
                runOnUiThread(() -> {
                    try {
                        if (granted) {
                            req.grant(req.getResources());
                        } else {
                            req.deny();
                        }
                    } catch (Exception ignored) {}
                });
            }
            notifyCameraPermissionResult(granted);
        }
    }
}


