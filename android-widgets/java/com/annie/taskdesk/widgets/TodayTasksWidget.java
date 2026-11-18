package com.annie.taskdesk.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;
import com.annie.taskdesk.MainActivity;
import com.annie.taskdesk.R;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class TodayTasksWidget extends AppWidgetProvider {
    private static final String PREFS_NAME = "taskdesk_widgets_data";
    private static final String KEY_SELECTED_BUCKET_PREFIX = "today_tasks_widget_bucket_";
    private static final String ACTION_SHOW_TODAY = "com.annie.taskdesk.widget.SHOW_TODAY";
    private static final String ACTION_SHOW_WEEK = "com.annie.taskdesk.widget.SHOW_WEEK";
    private static final String EXTRA_APP_WIDGET_ID = "appWidgetId";

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, TodayTasksWidget.class);
        int[] appWidgetIds = manager.getAppWidgetIds(componentName);
        for (int id : appWidgetIds) {
            updateAppWidget(context, manager, id);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (ACTION_SHOW_TODAY.equals(action) || ACTION_SHOW_WEEK.equals(action)) {
            int appWidgetId = intent.getIntExtra(EXTRA_APP_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                String bucket = ACTION_SHOW_WEEK.equals(action) ? "week" : "today";
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                        .edit()
                        .putString(KEY_SELECTED_BUCKET_PREFIX + appWidgetId, bucket)
                        .apply();
                updateAppWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
            }
            return;
        }
        super.onReceive(context, intent);
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today_tasks);

        // Intent to open Main App
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openAppPendingIntent = PendingIntent.getActivity(
                context, 0, openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_header, openAppPendingIntent);
        views.setOnClickPendingIntent(R.id.widget_empty_view, openAppPendingIntent);

        // Intent for Quick Capture button
        Intent quickCaptureIntent = new Intent(context, MainActivity.class);
        quickCaptureIntent.setAction("com.annie.taskdesk.ACTION_QUICK_CAPTURE");
        quickCaptureIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent quickCapturePending = PendingIntent.getActivity(
                context, 1, quickCaptureIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.btn_widget_add, quickCapturePending);

        // Read tasks and this widget instance's selected page from SharedPreferences.
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String rawJson = prefs.getString("raw_json", null);
        String selectedBucket = prefs.getString(KEY_SELECTED_BUCKET_PREFIX + appWidgetId, "today");
        if (!"week".equals(selectedBucket)) selectedBucket = "today";

        List<JSONObject> todayTasks = new ArrayList<>();
        List<JSONObject> weekTasks = new ArrayList<>();

        if (rawJson != null) {
            try {
                JSONObject data = new JSONObject(rawJson);
                JSONArray items = data.optJSONArray("items");
                if (items != null) {
                    for (int i = 0; i < items.length(); i++) {
                        JSONObject it = items.optJSONObject(i);
                        if (it != null) {
                            boolean isDone = it.optBoolean("done", false);
                            String bucket = it.optString("bucket", "");
                            String parentId = it.optString("parentId", "");
                            if (!parentId.isEmpty() || isDone) {
                                continue;
                            }
                            if ("today".equals(bucket)) {
                                todayTasks.add(it);
                            } else if ("week".equals(bucket)) {
                                weekTasks.add(it);
                            }
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        // The web app sends only confirmed workbench tasks, so the widget never
        // exposes inbox, keep/release, or child-task items.
        views.setTextViewText(
                R.id.widget_count_badge,
                "今日 " + todayTasks.size() + " · 這週 " + weekTasks.size()
        );
        boolean showingWeek = "week".equals(selectedBucket);
        views.setTextViewText(R.id.widget_title, showingWeek ? "Task Desk · 本週" : "Task Desk · 今日");
        // Keep tab rendering to RemoteViews' oldest, most reliable calls. The
        // title tells users which page is active; some launchers reject dynamic
        // background/text-colour reflection calls and show "Couldn't load widget".
        views.setTextViewText(R.id.widget_tab_today, showingWeek ? "今日" : "［今日］");
        views.setTextViewText(R.id.widget_tab_week, showingWeek ? "［本週］" : "本週");

        Intent showTodayIntent = new Intent(context, TodayTasksWidget.class);
        showTodayIntent.setAction(ACTION_SHOW_TODAY);
        showTodayIntent.putExtra(EXTRA_APP_WIDGET_ID, appWidgetId);
        PendingIntent showTodayPending = PendingIntent.getBroadcast(
                context, appWidgetId * 10 + 2, showTodayIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Intent showWeekIntent = new Intent(context, TodayTasksWidget.class);
        showWeekIntent.setAction(ACTION_SHOW_WEEK);
        showWeekIntent.putExtra(EXTRA_APP_WIDGET_ID, appWidgetId);
        PendingIntent showWeekPending = PendingIntent.getBroadcast(
                context, appWidgetId * 10 + 3, showWeekIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_tab_today, showTodayPending);
        views.setOnClickPendingIntent(R.id.widget_tab_week, showWeekPending);

        // Slots
        int[] rowIds = {
                R.id.widget_row_1, R.id.widget_row_2, R.id.widget_row_3,
                R.id.widget_row_4, R.id.widget_row_5, R.id.widget_row_6
        };
        int[] textIds = {
                R.id.widget_task_text_1, R.id.widget_task_text_2, R.id.widget_task_text_3,
                R.id.widget_task_text_4, R.id.widget_task_text_5, R.id.widget_task_text_6
        };
        int[] sizeIds = {
                R.id.widget_task_size_1, R.id.widget_task_size_2, R.id.widget_task_size_3,
                R.id.widget_task_size_4, R.id.widget_task_size_5, R.id.widget_task_size_6
        };
        List<JSONObject> selectedTasks = showingWeek ? weekTasks : todayTasks;
        List<JSONObject> visibleTasks = new ArrayList<>(selectedTasks.subList(0, Math.min(selectedTasks.size(), rowIds.length)));

        if (visibleTasks.isEmpty()) {
            views.setViewVisibility(R.id.widget_empty_view, View.VISIBLE);
            views.setTextViewText(R.id.widget_empty_view, showingWeek
                    ? "本週桌面尚無任務\n點擊進入挑選"
                    : "今日桌面尚無任務\n點擊進入挑選");
            for (int rowId : rowIds) {
                views.setViewVisibility(rowId, View.GONE);
            }
        } else {
            views.setViewVisibility(R.id.widget_empty_view, View.GONE);
            for (int i = 0; i < rowIds.length; i++) {
                if (i < visibleTasks.size()) {
                    JSONObject task = visibleTasks.get(i);
                    String text = task.optString("text", "未命名任務");
                    String size = task.optString("size", "small");
                    String sizeLabel = "小";
                    if ("medium".equals(size)) sizeLabel = "中";
                    else if ("large".equals(size)) sizeLabel = "大";

                    views.setViewVisibility(rowIds[i], View.VISIBLE);
                    views.setTextViewText(textIds[i], text);
                    views.setTextViewText(sizeIds[i], sizeLabel);
                    views.setOnClickPendingIntent(rowIds[i], openAppPendingIntent);
                } else {
                    views.setViewVisibility(rowIds[i], View.GONE);
                }
            }
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
