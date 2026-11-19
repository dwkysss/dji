package com.dentellejayainfinitex.dji;

import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.text.InputType;
import android.view.Gravity;
import android.view.MotionEvent;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String PREF_LOCK = "dji_kiosk_lock_prefs";
    private static final String KEY_PIN = "kiosk_pin";
    private static final String KEY_KIOSK_AUTO = "kiosk_auto_lock";
    private static final String DEFAULT_PIN = "454545";
    private boolean isSupervisorExiting = false;
    private long lastBackPressedTime = 0;
    private int secretCornerTapCount = 0;
    private long lastCornerTapTime = 0;

    private final BroadcastReceiver batteryReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (Intent.ACTION_BATTERY_LOW.equals(intent.getAction())) {
                runOnUiThread(() -> {
                    new AlertDialog.Builder(MainActivity.this)
                        .setTitle("⚠️ Peringatan: Baterai Lemah")
                        .setMessage("Baterai tablet hampir habis! Segera hubungkan kabel charger ke tablet agar tidak mati saat proses kerja.")
                        .setPositiveButton("OK, Mengerti", null)
                        .show();
                });
            }
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
                // Pastikan Screen Pinning (Lock Task) dimatikan agar status bar/notifikasi bebas ditarik dari atas
                if (isLockTaskActive()) {
                    stopLockTask();
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
            IntentFilter filter = new IntentFilter(Intent.ACTION_BATTERY_LOW);
            registerReceiver(batteryReceiver, filter);
        } catch (Exception ignored) {}

        hideSystemBars();
        configureWebViewCache();
        configureAppInterface();
        setupWebViewAutoRecovery();

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

        if (isLockTaskActive()) {
            try {
                stopLockTask();
            } catch (Exception ignored) {}
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
                }, "AndroidAppInfo");

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
}


