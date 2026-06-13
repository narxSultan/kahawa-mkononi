import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/app_notification.dart';
import 'dependencies.dart';

final unreadCountProvider = AutoDisposeFutureProvider<int>((ref) async {
  return ref.watch(notificationRepositoryProvider).unreadCount();
});

class NotificationsController extends AutoDisposeAsyncNotifier<List<AppNotification>> {
  bool _onlyUnread = false;

  @override
  Future<List<AppNotification>> build() async {
    return ref.watch(notificationRepositoryProvider).notifications(onlyUnread: _onlyUnread);
  }

  Future<void> setOnlyUnread(bool v) async {
    _onlyUnread = v;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async => ref.read(notificationRepositoryProvider).notifications(onlyUnread: _onlyUnread));
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async => ref.read(notificationRepositoryProvider).notifications(onlyUnread: _onlyUnread));
  }

  Future<AppNotification> markRead(String id) async {
    final updated = await ref.read(notificationRepositoryProvider).markRead(id);
    await reload();
    ref.invalidate(unreadCountProvider);
    return updated;
  }

  Future<void> delete(String id) async {
    await ref.read(notificationRepositoryProvider).delete(id);
    await reload();
    ref.invalidate(unreadCountProvider);
  }
}

final notificationsProvider = AutoDisposeAsyncNotifierProvider<NotificationsController, List<AppNotification>>(NotificationsController.new);

