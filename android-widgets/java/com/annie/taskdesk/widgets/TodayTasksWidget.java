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

        // Read tasks from SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences("taskdesk_widgets_data", Context.MODE_PRIVATE);
        String rawJson = prefs.getString("raw_json", null);

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
        views.setTextViewText(R.id.widget_title, "Task Desk · 今日 / 這週");

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
        List<JSONObject> visibleTasks = new ArrayList<>();
        visibleTasks.addAll(todayTasks.subList(0, Math.min(todayTasks.size(), 3)));
        visibleTasks.addAll(weekTasks.subList(0, Math.min(weekTasks.size(), 3)));

        if (visibleTasks.isEmpty()) {
            views.setViewVisibility(R.id.widget_empty_view, View.VISIBLE);
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
