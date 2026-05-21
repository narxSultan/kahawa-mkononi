import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/app_notification.dart';
import '../../providers/notifications_provider.dart';
import '../../utils/formatters.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/loading_view.dart';

class NotificationDetailScreen extends ConsumerStatefulWidget {
  final String notificationId;
  const NotificationDetailScreen({super.key, required this.notificationId});

  @override
  ConsumerState<NotificationDetailScreen> createState() => _NotificationDetailScreenState();
}

class _NotificationDetailScreenState extends ConsumerState<NotificationDetailScreen> {
  bool _marked = false;

  Future<AppNotification?> _find() async {
    final current = ref.read(notificationsProvider).valueOrNull;
    final found = current?.where((n) => n.id == widget.notificationId).toList().firstOrNull;
    if (found != null) return found;
    await ref.read(notificationsProvider.notifier).reload();
    final next = ref.read(notificationsProvider).valueOrNull;
    return next?.where((n) => n.id == widget.notificationId).toList().firstOrNull;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<AppNotification?>(
      future: _find(),
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) return const Scaffold(body: LoadingView());
        final n = snap.data;
        if (n == null) return const Scaffold(appBar: BrandedAppBar(title: Text('Notification')), body: Center(child: Text('Not found')));

        if (!_marked && !n.isRead) {
          _marked = true;
          Future.microtask(() => ref.read(notificationsProvider.notifier).markRead(n.id));
        }

        return Scaffold(
          appBar: const BrandedAppBar(title: Text('Notification')),
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(n.title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                Text(Formatters.dateTime(n.createdAt), style: const TextStyle(color: Colors.black54)),
                const SizedBox(height: 14),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: SelectableText(n.message),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

extension _FirstOrNull<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
