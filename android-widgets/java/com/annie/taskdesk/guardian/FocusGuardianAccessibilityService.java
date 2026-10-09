package com.annie.taskdesk.guardian;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.accessibility.AccessibilityEvent;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * FocusGuardianAccessibilityService
 * 專注守護無障礙服務：在專注期間即時攔截分心 App (如 YouTube、Instagram、TikTok 等)
 */
public class FocusGuardianAccessibilityService extends AccessibilityService {

    public static final String PREFS_NAME = "taskdesk_guardian_prefs";
    public static final String KEY_FOCUS_ACTIVE = "focus_active";
    public static final String KEY_ACTIVE_TASK = "active_task_text";
    public static final String KEY_EMERGENCY_PASS_UNTIL = "emergency_pass_until";
    public static final String KEY_BLOCKED_PACKAGES = "blocked_packages";

    // 預設常見分心 App Package Names
    public static final Set<String> DEFAULT_BLOCKED_PACKAGES = new HashSet<>(Arrays.asList(
            "com.google.android.youtube",             // YouTube
            "com.google.android.youtube.tv",          // YouTube TV
            "com.google.android.apps.youtube.kids",    // YouTube Kids
            "com.instagram.android",                  // Instagram
            "com.instagram.barcelona",                // Threads
            "com.facebook.katana",                    // Facebook
            "com.facebook.orca",                      // Messenger
            "com.twitter.android",                    // Twitter / X
            "com.zhiliaoapp.musically",               // TikTok
            "com.ss.android.ugc.trill",               // TikTok
            "com.reddit.frontpage",                   // Reddit
            "tv.danmaku.bili",                        // Bilibili
            "com.netflix.mediaclient",                // Netflix
            "tv.twitch.android.app",                  // Twitch
            "com.sparkslab.dcardreader",              // Dcard
            "com.manan.beptt",                        // BePTT
            "ptt.novus.beptt",                        // JPTT / BePTT
            "com.joshua.moptt",                       // MoPTT
            "com.bbs.piptt"                           // PiPTT
    ));

    private long lastInterceptTime = 0;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return;
        }

        CharSequence pkgChar = event.getPackageName();
        if (pkgChar == null) return;
        String currentPkg = pkgChar.toString();

        // 忽略自己和系統桌面/UI
        if (currentPkg.equals(getPackageName()) || 
            currentPkg.contains("launcher") || 
            currentPkg.equals("com.android.systemui") || 
            currentPkg.equals("android") ||
            currentPkg.equals("com.google.android.packageinstaller") ||
            currentPkg.equals("com.android.settings")) {
            return;
        }

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean isFocusActive = prefs.getBoolean(KEY_FOCUS_ACTIVE, false);
        if (!isFocusActive) {
            return; // 未開啟專注，直接放行
        }

        long emergencyPassUntil = prefs.getLong(KEY_EMERGENCY_PASS_UNTIL, 0);
        if (System.currentTimeMillis() < emergencyPassUntil) {
            return; // 處於臨時查資料放行期間，放行
        }

        // 讀取黑名單設定
        String customBlockedStr = prefs.getString(KEY_BLOCKED_PACKAGES, null);
        Set<String> blockedSet;
        if (customBlockedStr != null && !customBlockedStr.trim().isEmpty()) {
            blockedSet = new HashSet<>(Arrays.asList(customBlockedStr.split(",")));
        } else {
            blockedSet = DEFAULT_BLOCKED_PACKAGES;
        }

        if (blockedSet.contains(currentPkg)) {
            // 防抖動：1 秒內重複事件只攔截一次
            long now = System.currentTimeMillis();
            if (now - lastInterceptTime < 1000) {
                return;
            }
            lastInterceptTime = now;

            String activeTask = prefs.getString(KEY_ACTIVE_TASK, "專注工作中");

            // 啟動沉浸阻擋 Activity
            Intent blockIntent = new Intent(this, BlockOverlayActivity.class);
            blockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            blockIntent.putExtra("blocked_pkg", currentPkg);
            blockIntent.putExtra("task_text", activeTask);
            startActivity(blockIntent);
        }
    }

    @Override
    public void onInterrupt() {
        // 服務中斷回呼
    }
}
