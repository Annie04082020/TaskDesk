package com.annie.taskdesk;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;
import com.annie.taskdesk.widgets.TodayTasksWidget;
import com.annie.taskdesk.widgets.NowTaskWidget;
import com.annie.taskdesk.widgets.QuickCaptureWidget;

/**
 * Bridge exposing Android Widget update functionality to Web App.
 */
public class WidgetBridge {
    private final Context context;

    public WidgetBridge(Context context) {
        this.context = context.getApplicationContext();
    }

    @JavascriptInterface
    public void updateWidgetsData(String jsonData) {
        if (jsonData == null) return;
        try {
            SharedPreferences prefs = context.getSharedPreferences("taskdesk_widgets_data", Context.MODE_PRIVATE);
            prefs.edit().putString("raw_json", jsonData).putLong("last_updated", System.currentTimeMillis()).apply();

            // Refresh all 3 widget types
            TodayTasksWidget.updateAllWidgets(context);
            NowTaskWidget.updateAllWidgets(context);
            QuickCaptureWidget.updateAllWidgets(context);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
