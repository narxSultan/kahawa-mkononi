import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/order.dart';
import '../../providers/auth_controller.dart';
import '../../providers/notifications_provider.dart';
import '../../providers/orders_provider.dart';
import '../../providers/pending_confirm_orders_provider.dart';
import '../../services/app_badge_service.dart';
import '../../utils/formatters.dart';

class ShellScreen extends ConsumerStatefulWidget {
  final StatefulNavigationShell shell;
  const ShellScreen({super.key, required this.shell});

  @override
  ConsumerState<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends ConsumerState<ShellScreen>
    with WidgetsBindingObserver {
  bool _confirming = false;
  String? _confirmingOrderId;

  Future<void> _maybeShowAuthSuccess(AuthState next) async {
    final event = next.event;
    if (event == null) return;
    final title =
        event == AuthEvent.registerSuccess ? 'Account created' : 'Welcome back';
    final message = event == AuthEvent.registerSuccess
        ? 'Registration successful.'
        : 'Login successful.';
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.check_circle, color: Color(0xFF2E7D32)),
              SizedBox(width: 10),
              Expanded(child: Text('Success')),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(message),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      ref.read(authControllerProvider.notifier).clearEvent();
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ref.listenManual<AuthState>(
      authControllerProvider,
      (prev, next) {
        if (next.status == AuthStatus.unauthenticated) {
          AppBadgeService.clear();
        }
        if (next.event == null) return;
        if (prev?.event == next.event) return;
        _maybeShowAuthSuccess(next);
      },
    );

    ref.listenManual<AsyncValue<int>>(
      unreadCountProvider,
      (prev, next) {
        final count = next.valueOrNull;
        if (count == null) return;
        AppBadgeService.setCount(count);
      },
    );

    ref.listenManual<AsyncValue<List<Order>>>(
      pendingConfirmOrdersProvider,
      (prev, next) {
        final list = next.valueOrNull ?? const [];
        if (list.isEmpty) return;
        if (_confirming) return;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _showConfirmDialog(list);
        });
      },
    );

    // If we arrive here already authenticated (after login/register), show once.
    _maybeShowAuthSuccess(ref.read(authControllerProvider));
    Future.microtask(_syncBadgeCount);
  }

  Future<void> _syncBadgeCount() async {
    try {
      final count = await ref.read(unreadCountProvider.future);
      if (!mounted) return;
      await AppBadgeService.setCount(count);
    } catch (_) {
      return;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.invalidate(unreadCountProvider);
      Future.microtask(_syncBadgeCount);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<String?> _promptRejectReason() async {
    final ctrl = TextEditingController();
    while (true) {
      final ok = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (c) => AlertDialog(
          title: const Text('Why not completed?'),
          content: TextField(
            controller: ctrl,
            maxLines: 4,
            decoration: const InputDecoration(hintText: 'Type reason...'),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(c).pop(false),
                child: const Text('Back')),
            ElevatedButton(
                onPressed: () => Navigator.of(c).pop(true),
                child: const Text('Submit')),
          ],
        ),
      );
      if (ok != true) {
        ctrl.dispose();
        return null;
      }
      final reason = ctrl.text.trim();
      if (reason.isNotEmpty) {
        ctrl.dispose();
        return reason;
      }
    }
  }

  Future<void> _showConfirmDialog(List<Order> orders) async {
    if (_confirming) return;
    final candidate = orders.firstWhere(
      (o) => o.id != _confirmingOrderId,
      orElse: () => orders.first,
    );
    _confirming = true;
    _confirmingOrderId = candidate.id;

    final messenger = ScaffoldMessenger.of(context);
    try {
      final centre = candidate.serviceCentre?.centreName ??
          candidate.transferredToServiceCentre?.centreName ??
          '—';
      final action = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (c) => AlertDialog(
          title: const Text('Order complete'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Order ${candidate.id.substring(0, 6)}',
                  style: const TextStyle(fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              Text('Centre: $centre'),
              const SizedBox(height: 6),
              Text(
                  'Ready at: ${Formatters.dateTime(candidate.staffCompletedAt ?? candidate.updatedAt)}'),
              const SizedBox(height: 10),
              const Text(
                  'Staff marked this order complete. Confirm to continue using the app.',
                  style: TextStyle(color: Colors.black87)),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(c).pop(false),
                child: const Text('Not completed')),
            ElevatedButton(
                onPressed: () => Navigator.of(c).pop(true),
                child: const Text('Yes, completed')),
          ],
        ),
      );

      if (action == true) {
        await ref.read(ordersProvider.notifier).acknowledge(candidate.id);
        if (!mounted) return;
        messenger.showSnackBar(
            const SnackBar(content: Text('Thank you for confirming.')));
      } else if (action == false) {
        final reason = await _promptRejectReason();
        if (reason == null) {
          // User went back; show confirm again.
          if (!mounted) return;
          _confirming = false;
          _confirmingOrderId = null;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            _showConfirmDialog(orders);
          });
          return;
        }
        await ref
            .read(ordersProvider.notifier)
            .reject(orderId: candidate.id, reason: reason);
        if (!mounted) return;
        messenger.showSnackBar(const SnackBar(
            content: Text('Submitted. We will review your issue.')));
      }
    } finally {
      _confirming = false;
      _confirmingOrderId = null;
      ref.invalidate(pendingConfirmOrdersProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final unread = ref
        .watch(unreadCountProvider)
        .maybeWhen(data: (v) => v, orElse: () => 0);

    return Scaffold(
      body: widget.shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: widget.shell.currentIndex,
        onDestinationSelected: (i) => widget.shell
            .goBranch(i, initialLocation: i == widget.shell.currentIndex),
        destinations: [
          const NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home),
              label: 'Home'),
          const NavigationDestination(
              icon: Icon(Icons.receipt_long_outlined),
              selectedIcon: Icon(Icons.receipt_long),
              label: 'Orders'),
          NavigationDestination(
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.notifications_none),
                if (unread > 0)
                  Positioned(
                    right: -6,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                          color: const Color(0xFFC62828),
                          borderRadius: BorderRadius.circular(999)),
                      child: Text(
                        unread > 99 ? '99+' : '$unread',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w800),
                      ),
                    ),
                  )
              ],
            ),
            selectedIcon: const Icon(Icons.notifications),
            label: 'Alerts',
          ),
          const NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Profile'),
        ],
      ),
    );
  }
}
