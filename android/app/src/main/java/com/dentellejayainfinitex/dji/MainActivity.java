package com.dentellejayainfinitex.dji;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWebViewCache();
        configureAppInterface();
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebViewCache();
        configureAppInterface();
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

        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
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

    private long lastBackPressTime = 0;

    @Override
    public void onBackPressed() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
            }
        } catch (Exception ignored) {}

        if (System.currentTimeMillis() - lastBackPressTime < 2000) {
            super.onBackPressed();
        } else {
            lastBackPressTime = System.currentTimeMillis();
            android.widget.Toast.makeText(this, "Tekan sekali lagi untuk keluar aplikasi", android.widget.Toast.LENGTH_SHORT).show();
        }
    }
}


