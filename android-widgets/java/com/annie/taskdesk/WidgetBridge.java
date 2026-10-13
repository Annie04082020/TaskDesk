package com.annie.taskdesk;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.text.TextUtils;
import android.webkit.JavascriptInterface;
import com.annie.taskdesk.guardian.FocusGuardianAccessibilityService;
import com.annie.taskdesk.widgets.TodayTasksWidget;
import com.annie.taskdesk.widgets.NowTaskWidget;
import com.annie.taskdesk.widgets.QuickCaptureWidget;

/**
 * Bridge exposing Android Widget update & Focus Guardian functionality to Web App.
 */
public class WidgetBridge {
    private static final int MAX_WIDGET_JSON_LENGTH = 250_000;
    private static final int MAX_TASK_TEXT_LENGTH = 300;
    private static final int MAX_BLOCKED_PACKAGES = 50;
    private final Context context;

    public WidgetBridge(Context context) {
        this.context = context.getApplicationContext();
    }

    @JavascriptInterface
    public void updateWidgetsData(String jsonData) {
        if (jsonData == null || jsonData.length() > MAX_WIDGET_JSON_LENGTH) return;
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

    // --- Focus Guardian (取代 StayFree 原生鎖定守護) ---

    @JavascriptInterface
    public void setFocusActive(boolean active, String taskText) {
        try {
            String safeTaskText = taskText == null ? "" : taskText.trim();
            if (safeTaskText.length() > MAX_TASK_TEXT_LENGTH) {
                safeTaskText = safeTaskText.substring(0, MAX_TASK_TEXT_LENGTH);
            }
            SharedPreferences prefs = context.getSharedPreferences(FocusGuardianAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putBoolean(FocusGuardianAccessibilityService.KEY_FOCUS_ACTIVE, active);
            editor.putString(FocusGuardianAccessibilityService.KEY_ACTIVE_TASK, safeTaskText);
            if (!active) {
                editor.putLong(FocusGuardianAccessibilityService.KEY_EMERGENCY_PASS_UNTIL, 0);
            }
            editor.apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public boolean isAccessibilityGranted() {
        try {
            int accessibilityEnabled = Settings.Secure.getInt(
                    context.getContentResolver(),
                    Settings.Secure.ACCESSIBILITY_ENABLED, 0);
            if (accessibilityEnabled != 1) return false;

            String services = Settings.Secure.getString(
                    context.getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (services == null) return false;

            String myService = context.getPackageName() + "/" + FocusGuardianAccessibilityService.class.getName();
            String myServiceShort = context.getPackageName() + "/.guardian.FocusGuardianAccessibilityService";

            return services.contains(myService) || services.contains(myServiceShort);
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public void openAccessibilitySettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public String getBlockedPackages() {
        try {
            SharedPreferences prefs = context.getSharedPreferences(FocusGuardianAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE);
            String saved = prefs.getString(FocusGuardianAccessibilityService.KEY_BLOCKED_PACKAGES, null);
            if (saved != null && !saved.trim().isEmpty()) {
                return saved;
            }
            return TextUtils.join(",", FocusGuardianAccessibilityService.DEFAULT_BLOCKED_PACKAGES);
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public void setBlockedPackages(String commaSeparatedPackages) {
        try {
            if (commaSeparatedPackages == null || commaSeparatedPackages.length() > 4000) return;
            StringBuilder safePackages = new StringBuilder();
            int packageCount = 0;
            for (String rawPackage : commaSeparatedPackages.split(",")) {
                String packageName = rawPackage.trim();
                if (!packageName.matches("[a-zA-Z0-9_]+(\\.[a-zA-Z0-9_]+)+")) continue;
                if (packageCount++ >= MAX_BLOCKED_PACKAGES) break;
                if (safePackages.length() > 0) safePackages.append(',');
                safePackages.append(packageName);
            }
            SharedPreferences prefs = context.getSharedPreferences(FocusGuardianAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(FocusGuardianAccessibilityService.KEY_BLOCKED_PACKAGES, safePackages.toString()).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void requestEmergencyPass(int durationMinutes) {
        try {
            int safeDurationMinutes = Math.max(1, Math.min(10, durationMinutes));
            long until = System.currentTimeMillis() + (long) safeDurationMinutes * 60 * 1000;
            SharedPreferences prefs = context.getSharedPreferences(FocusGuardianAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putLong(FocusGuardianAccessibilityService.KEY_EMERGENCY_PASS_UNTIL, until).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
