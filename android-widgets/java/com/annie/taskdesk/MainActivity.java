package com.annie.taskdesk;

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
}
