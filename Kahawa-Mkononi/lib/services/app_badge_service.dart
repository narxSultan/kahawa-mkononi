import 'package:flutter/services.dart';

class AppBadgeService {
  static const MethodChannel _channel =
      MethodChannel('kahawa_mkononi/app_badge');

  static Future<void> setCount(int count) async {
    try {
      await _channel.invokeMethod<void>('setBadgeCount', <String, int>{
        'count': count < 0 ? 0 : count,
      });
    } on MissingPluginException {
      return;
    } on PlatformException {
      return;
    }
  }

  static Future<void> clear() => setCount(0);
}
