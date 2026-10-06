package com.annie.taskdesk;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new WidgetBridge(this), "AndroidWidgetBridge");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        handleIntentAction(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntentAction(intent);
    }

    private void handleIntentAction(Intent intent) {
        if (intent != null && "com.annie.taskdesk.ACTION_QUICK_CAPTURE".equals(intent.getAction())) {
            WebView webView = this.bridge != null ? this.bridge.getWebView() : null;
            if (webView != null) {
                webView.post(() -> {
                    webView.evaluateJavascript("window.handleQuickCaptureFromWidget && window.handleQuickCaptureFromWidget();", null);
                });
            }
        }
    }
}
