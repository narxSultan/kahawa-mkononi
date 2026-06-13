import '../../models/app_notification.dart';
import 'graphql_api.dart';

class NotificationRepository {
  final GraphqlApi api;
  NotificationRepository(this.api);

  Future<int> unreadCount() async {
    final data = await api.query(r'''query Unread { unreadNotificationCount }''');
    return (data['unreadNotificationCount'] as int?) ?? 0;
  }

  Future<List<AppNotification>> notifications({bool onlyUnread = false}) async {
    final data = await api.query(
      r'''
query Notifications($onlyUnread: Boolean!) {
  notifications(pagination:{page:1,pageSize:50}, onlyUnread:$onlyUnread) {
    nodes { id title message type isRead createdAt }
  }
}
''',
      variables: {'onlyUnread': onlyUnread},
    );
    final nodes = ((data['notifications'] as Map<String, dynamic>)['nodes'] as List<dynamic>? ?? const []);
    return nodes.map((x) => AppNotification.fromJson(x as Map<String, dynamic>)).toList();
  }

  Future<AppNotification> markRead(String id) async {
    final data = await api.mutate(
      r'''
mutation Read($id: ID!) {
  markNotificationRead(id:$id) { id title message type isRead createdAt }
}
''',
      variables: {'id': id},
    );
    return AppNotification.fromJson(data['markNotificationRead'] as Map<String, dynamic>);
  }

  Future<bool> delete(String id) async {
    final data = await api.mutate(
      r'''
mutation Del($id: ID!) {
  deleteNotification(id:$id)
}
''',
      variables: {'id': id},
    );
    return (data['deleteNotification'] as bool?) ?? false;
  }
}

