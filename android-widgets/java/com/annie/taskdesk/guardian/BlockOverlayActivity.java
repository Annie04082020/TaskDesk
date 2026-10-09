package com.annie.taskdesk.guardian;

import androidx.appcompat.app.AppCompatActivity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import com.annie.taskdesk.MainActivity;
import com.annie.taskdesk.R;

public class BlockOverlayActivity extends AppCompatActivity {

    private String blockedPkg = "";
    private String taskText = "";
    private CountDownTimer countDownTimer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_block_overlay);

        extractIntentData(getIntent());
        initViews();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        extractIntentData(intent);
        initViews();
    }

    private void extractIntentData(Intent intent) {
        if (intent != null) {
            blockedPkg = intent.getStringExtra("blocked_pkg");
            taskText = intent.getStringExtra("task_text");
        }
    }

    private void initViews() {
        TextView tvTask = findViewById(R.id.tvBlockedTaskText);
        TextView tvApp = findViewById(R.id.tvBlockedAppName);
        Button btnReturn = findViewById(R.id.btnReturnToTaskDesk);
        Button btnFrictionPass = findViewById(R.id.btnFrictionPass);
        Button btnHome = findViewById(R.id.btnGoHome);
        final View frictionLayout = findViewById(R.id.layoutFrictionOverlay);
        final TextView tvCountdown = findViewById(R.id.tvBreathingCountdown);

        if (taskText != null && !taskText.isEmpty()) {
            tvTask.setText(taskText);
        } else {
            tvTask.setText("專注任務執行中");
        }

        // 取得被攔截 App 的人類可讀名稱
        String appLabel = blockedPkg;
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(blockedPkg, 0);
            appLabel = pm.getApplicationLabel(ai).toString();
        } catch (Exception e) {}
        tvApp.setText("已攔截分心 App：" + appLabel);

        // 1. 返回 TaskDesk
        btnReturn.setOnClickListener(v -> {
            Intent mainIntent = new Intent(this, MainActivity.class);
            mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            startActivity(mainIntent);
            finish();
        });

        // 2. 深呼吸 5 秒冷卻通行 (3 分鐘)
        btnFrictionPass.setOnClickListener(v -> {
            if (frictionLayout != null) {
                frictionLayout.setVisibility(View.VISIBLE);
            }
            if (countDownTimer != null) countDownTimer.cancel();

            countDownTimer = new CountDownTimer(5000, 1000) {
                @Override
                public void onTick(long millisUntilFinished) {
                    if (tvCountdown != null) {
                        tvCountdown.setText(String.valueOf((millisUntilFinished / 1000) + 1));
                    }
                }

                @Override
                public void onFinish() {
                    // 放行 3 分鐘
                    SharedPreferences prefs = getSharedPreferences(FocusGuardianAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE);
                    prefs.edit().putLong(FocusGuardianAccessibilityService.KEY_EMERGENCY_PASS_UNTIL, 
                            System.currentTimeMillis() + 3 * 60 * 1000).apply();
                    
                    finish(); // 關閉阻擋畫面，使用者可正常使用原 App
                }
            }.start();
        });

        // 3. 回到手機桌面
        btnHome.setOnClickListener(v -> {
            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
            homeIntent.addCategory(Intent.CATEGORY_HOME);
            homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(homeIntent);
            finish();
        });
    }

    @Override
    public void onBackPressed() {
        // 防止使用者按返回鍵直接退回分心 App，改為退回桌面
        Intent homeIntent = new Intent(Intent.ACTION_MAIN);
        homeIntent.addCategory(Intent.CATEGORY_HOME);
        homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(homeIntent);
        finish();
    }

    @Override
    protected void onDestroy() {
        if (countDownTimer != null) {
            countDownTimer.cancel();
        }
        super.onDestroy();
    }
}
