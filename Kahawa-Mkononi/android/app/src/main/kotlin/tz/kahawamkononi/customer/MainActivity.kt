package tz.kahawamkononi.customer

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import me.leolin.shortcutbadger.ShortcutBadger

class MainActivity: FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "kahawa_mkononi/app_badge").setMethodCallHandler { call, result ->
            when (call.method) {
                "setBadgeCount" -> {
                    val count = call.argument<Int>("count") ?: 0
                    if (count > 0) {
                        ShortcutBadger.applyCount(applicationContext, count)
                    } else {
                        ShortcutBadger.removeCount(applicationContext)
                    }
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }
}
