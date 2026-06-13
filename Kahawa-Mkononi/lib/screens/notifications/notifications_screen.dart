import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/notifications_provider.dart';
import '../../utils/formatters.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/empty_view.dart';
import '../../widgets/error_view.dart';
import '../../widgets/loading_view.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _onlyUnread = false;

  @override
  Widget build(BuildContext context) {
    final notes = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: BrandedAppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            onPressed: () => ref.read(notificationsProvider.notifier).reload(),
            icon: const Icon(Icons.refresh),
          )
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            SwitchListTile(
              value: _onlyUnread,
              onChanged: (v) async {
                setState(() => _onlyUnread = v);
                await ref.read(notificationsProvider.notifier).setOnlyUnread(v);
              },
              title: const Text('Only unread'),
            ),
            Expanded(
              child: notes.when(
                loading: () => const LoadingView(),
                error: (e, _) => ErrorView(title: 'Failed to load notifications', details: e.toString(), onRetry: () => ref.read(notificationsProvider.notifier).reload()),
                data: (list) {
                  if (list.isEmpty) return const EmptyView(title: 'No notifications', subtitle: 'Your updates will appear here.');
                  return RefreshIndicator(
                    onRefresh: () async => ref.read(notificationsProvider.notifier).reload(),
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                      itemCount: list.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final n = list[i];
                        return Card(
                          child: ListTile(
                            onTap: () => context.push('/notifications/${n.id}'),
                            leading: Icon(n.isRead ? Icons.mark_email_read_outlined : Icons.markunread_outlined),
                            title: Text(n.title, style: TextStyle(fontWeight: n.isRead ? FontWeight.w700 : FontWeight.w900)),
                            subtitle: Text(Formatters.dateTime(n.createdAt), style: const TextStyle(color: Colors.black54)),
                            trailing: IconButton(
                              onPressed: () async {
                                final ok = await showDialog<bool>(
                                  context: context,
                                  builder: (c) => AlertDialog(
                                    title: const Text('Delete notification?'),
                                    content: const Text('This will remove it from your inbox.'),
                                    actions: [
                                      TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Cancel')),
                                      ElevatedButton(onPressed: () => Navigator.of(c).pop(true), child: const Text('Delete')),
                                    ],
                                  ),
                                );
                                if (ok == true) {
                                  await ref.read(notificationsProvider.notifier).delete(n.id);
                                }
                              },
                              icon: const Icon(Icons.delete_outline),
                            ),
                          ),
                        );
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
