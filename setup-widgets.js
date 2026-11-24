/**
 * setup-widgets.js
 * Retained as the Android native setup entry point for release compatibility.
 * AppWidgets have been removed; this script now installs only Focus Guardian
 * bridge/resources and strips widget receivers from generated Capacitor apps.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const NATIVE_DIR = path.join(ROOT_DIR, 'android-widgets');
const ANDROID_MAIN = path.join(ROOT_DIR, 'android', 'app', 'src', 'main');
const WIDGET_ARTIFACTS = [
  'java/com/annie/taskdesk/widgets/TodayTasksWidget.java',
  'java/com/annie/taskdesk/widgets/NowTaskWidget.java',
  'java/com/annie/taskdesk/widgets/QuickCaptureWidget.java',
  'res/layout/widget_today_tasks.xml',
  'res/layout/widget_now_task.xml',
  'res/layout/widget_quick_capture.xml',
  'res/xml/widget_today_tasks_info.xml',
  'res/xml/widget_now_task_info.xml',
  'res/xml/widget_quick_capture_info.xml',
  'res/drawable/widget_bg_rounded.xml',
  'res/drawable/widget_btn_bg.xml',
  'res/drawable/widget_tag_bg.xml',
  'res/drawable/widget_tab_active.xml',
  'res/drawable/widget_tab_inactive.xml',
  'res/values/widget_strings.xml'
];

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(file => copyRecursive(path.join(src, file), path.join(dest, file)));
    return;
  }
  fs.copyFileSync(src, dest);
  console.log(`[Android native] Copied: ${path.relative(ROOT_DIR, dest)}`);
}

function removeWidgetArtifacts() {
  WIDGET_ARTIFACTS.forEach(relativePath => {
    const target = path.join(ANDROID_MAIN, relativePath);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
      console.log(`[Android native] Removed widget artifact: ${relativePath}`);
    }
  });
}

function injectGuardian(manifestPath) {
  if (!fs.existsSync(manifestPath)) throw new Error(`AndroidManifest.xml not found: ${manifestPath}`);
  const original = fs.readFileSync(manifestPath, 'utf8');
  let content = original.replace(
    /\s*<!-- Task Desk Widgets -->\s*<receiver\b[^>]*android:name="\.widgets\.[^"]+"[^>]*>[\s\S]*?<\/receiver>/g,
    ''
  );
  const guardianPresent = content.includes('.guardian.FocusGuardianAccessibilityService')
    && content.includes('@xml/focus_guardian_accessibility_config');

  if (!guardianPresent) {
    const missingPermissions = ['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.POST_NOTIFICATIONS']
      .filter(permission => !content.includes(permission))
      .map(permission => `    <uses-permission android:name="${permission}" />`)
      .join('\n');
    if (missingPermissions) content = content.replace('<application', `${missingPermissions}\n    <application`);
    const guardianSnippet = `
        <!-- Focus Guardian -->
        <service
            android:name="com.annie.taskdesk.guardian.FocusGuardianAccessibilityService"
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
            android:name="com.annie.taskdesk.guardian.BlockOverlayActivity"
            android:exported="false"
            android:theme="@style/AppTheme.NoActionBar"
            android:launchMode="singleTop" />
    </application>`;
    content = content.replace('</application>', guardianSnippet);
  }
  if (content !== original) fs.writeFileSync(manifestPath, content, 'utf8');
}

function main() {
  if (!fs.existsSync(ANDROID_MAIN)) {
    console.log('[Android native] android/app/src/main does not exist yet. Run npx cap add android first.');
    return;
  }

  copyRecursive(path.join(NATIVE_DIR, 'java', 'com', 'annie', 'taskdesk', 'MainActivity.java'),
    path.join(ANDROID_MAIN, 'java', 'com', 'annie', 'taskdesk', 'MainActivity.java'));
  copyRecursive(path.join(NATIVE_DIR, 'java', 'com', 'annie', 'taskdesk', 'WidgetBridge.java'),
    path.join(ANDROID_MAIN, 'java', 'com', 'annie', 'taskdesk', 'WidgetBridge.java'));
  copyRecursive(path.join(NATIVE_DIR, 'java', 'com', 'annie', 'taskdesk', 'guardian'),
    path.join(ANDROID_MAIN, 'java', 'com', 'annie', 'taskdesk', 'guardian'));
  copyRecursive(path.join(NATIVE_DIR, 'res', 'layout', 'activity_block_overlay.xml'),
    path.join(ANDROID_MAIN, 'res', 'layout', 'activity_block_overlay.xml'));
  copyRecursive(path.join(NATIVE_DIR, 'res', 'xml', 'focus_guardian_accessibility_config.xml'),
    path.join(ANDROID_MAIN, 'res', 'xml', 'focus_guardian_accessibility_config.xml'));

  removeWidgetArtifacts();
  injectGuardian(path.join(ANDROID_MAIN, 'AndroidManifest.xml'));
  console.log('[Android native] Focus Guardian setup complete; AppWidgets are disabled.');
}

main();
