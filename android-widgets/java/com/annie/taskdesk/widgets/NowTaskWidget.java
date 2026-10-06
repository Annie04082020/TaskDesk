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

public class NowTaskWidget extends AppWidgetProvider {

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, NowTaskWidget.class);
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
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_now_task);

        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 2, openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_now_root, pendingIntent);

        SharedPreferences prefs = context.getSharedPreferences("taskdesk_widgets_data", Context.MODE_PRIVATE);
        String rawJson = prefs.getString("raw_json", null);

        JSONObject nowTask = null;
        if (rawJson != null) {
            try {
                JSONObject data = new JSONObject(rawJson);
                JSONArray items = data.optJSONArray("items");
                if (items != null) {
                    for (int i = 0; i < items.length(); i++) {
                        JSONObject it = items.optJSONObject(i);
                        if (it != null && it.optBoolean("isNow", false) && !it.optBoolean("done", false)) {
                            nowTask = it;
                            break;
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        if (nowTask != null) {
            views.setViewVisibility(R.id.widget_now_content, View.VISIBLE);
            views.setViewVisibility(R.id.widget_now_empty, View.GONE);

            String text = nowTask.optString("text", "未命名任務");
            String size = nowTask.optString("size", "small");
            String sizeLabel = "小 15-30m";
            if ("medium".equals(size)) sizeLabel = "中 1-2h";
            else if ("large".equals(size)) sizeLabel = "大 2h+";

            views.setTextViewText(R.id.widget_now_title, text);
            views.setTextViewText(R.id.widget_now_tag, sizeLabel);
        } else {
            views.setViewVisibility(R.id.widget_now_content, View.GONE);
            views.setViewVisibility(R.id.widget_now_empty, View.VISIBLE);
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
