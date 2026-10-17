package com.dentellejayainfinitex.dji;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
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
                }, "AndroidAppInfo");
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


