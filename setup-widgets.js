/**
 * setup-widgets.js
 * Injects Android AppWidget classes, layouts, and receivers into Capacitor's android platform.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const WIDGETS_DIR = path.join(ROOT_DIR, 'android-widgets');
const ANDROID_MAIN = path.join(ROOT_DIR, 'android', 'app', 'src', 'main');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(file => {
      copyRecursive(path.join(src, file), path.join(dest, file));
    });
  } else {
    fs.copyFileSync(src, dest);
    console.log(`[Widgets] Copied: ${path.relative(ROOT_DIR, dest)}`);
  }
}

function injectManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    console.warn(`[Widgets] Manifest not found at ${manifestPath}`);
    return;
  }

  let content = fs.readFileSync(manifestPath, 'utf8');
  if (content.includes('TodayTasksWidget')) {
    console.log('[Widgets] Receivers already present in AndroidManifest.xml');
    return;
  }

  const receiverSnippet = `
        <!-- Task Desk Widgets -->
        <receiver
            android:name=".widgets.TodayTasksWidget"
            android:exported="true"
            android:label="@string/widget_today_label">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_today_tasks_info" />
        </receiver>

        <receiver
            android:name=".widgets.NowTaskWidget"
            android:exported="true"
            android:label="@string/widget_now_label">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_now_task_info" />
        </receiver>

        <receiver
            android:name=".widgets.QuickCaptureWidget"
            android:exported="true"
            android:label="@string/widget_capture_label">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_quick_capture_info" />
        </receiver>

        <!-- Focus Guardian (取代 StayFree 原生鎖定守護服務) -->
        <service
            android:name=".guardian.FocusGuardianAccessibilityService"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true"
            android:label="@string/accessibility_guardian_label">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/focus_guardian_accessibility_config" />
        </service>

        <activity
            android:name=".guardian.BlockOverlayActivity"
            android:exported="false"
            android:theme="@android:style/Theme.NoTitleBar.Fullscreen"
            android:launchMode="singleTop" />
    </application>`;

  if (!content.includes('android.permission.SYSTEM_ALERT_WINDOW')) {
    content = content.replace('<application', '    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />\n    <application');
  }

  if (content.includes('</application>')) {
    content = content.replace('</application>', receiverSnippet);
    fs.writeFileSync(manifestPath, content, 'utf8');
    console.log('[Widgets & Guardian] Successfully injected AppWidget receivers and Focus Guardian into AndroidManifest.xml');
  } else {
    console.warn('[Widgets] Could not find </application> tag in AndroidManifest.xml');
  }
}

function main() {
  if (!fs.existsSync(ANDROID_MAIN)) {
    console.log('[Widgets] android/app/src/main does not exist yet. Please run "npx cap add android" first.');
    return;
  }

  console.log('[Widgets] Injecting Android widgets into', ANDROID_MAIN);

  // 1. Copy Java sources
  const srcJava = path.join(WIDGETS_DIR, 'java');
  const destJava = path.join(ANDROID_MAIN, 'java');
  copyRecursive(srcJava, destJava);

  // 2. Copy Resources (drawables, layouts, xmls, values)
  const srcRes = path.join(WIDGETS_DIR, 'res');
  const destRes = path.join(ANDROID_MAIN, 'res');
  copyRecursive(srcRes, destRes);

  // 3. Patch AndroidManifest.xml
  const manifestPath = path.join(ANDROID_MAIN, 'AndroidManifest.xml');
  injectManifest(manifestPath);

  console.log('[Widgets] Android AppWidgets setup completed successfully!');
}

main();
