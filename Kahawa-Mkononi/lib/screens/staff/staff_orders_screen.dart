import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/order.dart';
import '../../models/service_centre.dart';
import '../../providers/staff_orders_provider.dart';
import '../../providers/auth_controller.dart';
import '../../providers/dependencies.dart';
import '../../utils/formatters.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/empty_view.dart';
import '../../widgets/error_view.dart';
import '../../widgets/loading_view.dart';

class StaffOrdersScreen extends ConsumerStatefulWidget {
  const StaffOrdersScreen({super.key});

  @override
  ConsumerState<StaffOrdersScreen> createState() => _StaffOrdersScreenState();
}

class _StaffOrdersScreenState extends ConsumerState<StaffOrdersScreen> {
  Future<String?> _promptMessage({required String title, required String hint}) async {
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (c) => AlertDialog(
        title: Text(title),
        content: TextField(controller: ctrl, maxLines: 4, decoration: InputDecoration(hintText: hint)),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.of(c).pop(true), child: const Text('Send')),
        ],
      ),
    );
    final msg = ctrl.text.trim();
    ctrl.dispose();
    if (ok != true) return null;
    if (msg.isEmpty) return null;
    return msg;
  }

  Future<bool> _confirmDelete({required String title, required String message}) async {
    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (c) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFC62828), foregroundColor: Colors.white),
            onPressed: () => Navigator.of(c).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    return ok == true;
  }

  Future<ServiceCentre?> _pickCentre({required String? currentCentreId}) async {
    return showModalBottomSheet<ServiceCentre>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _TransferCentreSheet(currentCentreId: currentCentreId),
    );
  }

  @override
  Widget build(BuildContext context) {
    final orders = ref.watch(staffOrdersProvider);
    final role = ref.watch(authControllerProvider).user?.roleName ?? '';
    final canTransferRole = role == 'ADMIN' || role == 'MANAGER';

    return Scaffold(
      appBar: BrandedAppBar(
        title: const Text('Incoming orders'),
        actions: [
          IconButton(
            tooltip: 'Logout',
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
          ),
          IconButton(
            tooltip: 'Reload',
            onPressed: () => ref.read(staffOrdersProvider.notifier).reload(),
            icon: const Icon(Icons.refresh),
          )
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            SizedBox(
              height: 50,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                scrollDirection: Axis.horizontal,
                children: [
                  _FilterChip(label: 'All', onTap: () => ref.read(staffOrdersProvider.notifier).filterStatus(null)),
                  _FilterChip(label: 'Pending', onTap: () => ref.read(staffOrdersProvider.notifier).filterStatus('PENDING')),
                  _FilterChip(label: 'Ready', onTap: () => ref.read(staffOrdersProvider.notifier).filterStatus('STAFF_COMPLETED')),
                  _FilterChip(label: 'Rejected', onTap: () => ref.read(staffOrdersProvider.notifier).filterStatus('CUSTOMER_REJECTED')),
                  _FilterChip(label: 'Completed', onTap: () => ref.read(staffOrdersProvider.notifier).filterStatus('COMPLETED')),
                  _FilterChip(label: 'Cancelled', onTap: () => ref.read(staffOrdersProvider.notifier).filterStatus('CANCELLED')),
                ],
              ),
            ),
            Expanded(
              child: orders.when(
                loading: () => const LoadingView(),
                error: (e, _) => ErrorView(title: 'Failed to load orders', details: e.toString(), onRetry: () => ref.read(staffOrdersProvider.notifier).reload()),
                data: (list) {
                  if (list.isEmpty) return const EmptyView(title: 'No orders', subtitle: 'New orders will appear here.');
                  return RefreshIndicator(
                    onRefresh: () async => ref.read(staffOrdersProvider.notifier).reload(),
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                      itemCount: list.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final o = list[i];
                        final customer = o.customer?.fullName ?? 'Customer';
                        final centre = o.serviceCentre?.centreName ?? '—';
                        final status = o.status;
                        final canDelete = status == 'COMPLETED' || status == 'CUSTOMER_REJECTED' || status == 'CANCELLED';
                        final canTransferStatus = status == 'PENDING' || status == 'STAFF_COMPLETED' || status == 'CUSTOMER_REJECTED';
                        final canTransfer = canTransferRole && canTransferStatus;

                        return Card(
                          child: ListTile(
                            onTap: () => context.push('/staff/orders/${o.id}'),
                            title: Text('Order ${o.id.substring(0, 6)} • $customer', style: const TextStyle(fontWeight: FontWeight.w900)),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 4),
                                Text('Centre: $centre'),
                                Text('Total: ${o.totalAmount} ${o.currency}'),
                                Text('Created: ${Formatters.dateTime(o.createdAt)}', style: const TextStyle(color: Colors.black54)),
                              ],
                            ),
                            trailing: Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: [
                                _StatusBadge.fromOrder(o),
                                if (status == 'PENDING')
                                  IconButton(
                                    tooltip: 'Message',
                                    onPressed: () async {
                                      final messenger = ScaffoldMessenger.of(context);
                                      final msg = await _promptMessage(title: 'Message customer', hint: 'Type message...');
                                      if (msg == null) return;
                                      await ref.read(staffOrdersProvider.notifier).staffMessage(orderId: o.id, message: msg);
                                      if (!mounted) return;
                                      messenger.showSnackBar(const SnackBar(content: Text('Message sent')));
                                    },
                                    icon: const Icon(Icons.chat_bubble_outline),
                                  ),
                                if (status == 'PENDING')
                                  IconButton.filledTonal(
                                    tooltip: 'Mark ready',
                                    onPressed: () async {
                                      final messenger = ScaffoldMessenger.of(context);
                                      await ref.read(staffOrdersProvider.notifier).staffComplete(o.id);
                                      if (!mounted) return;
                                      messenger.showSnackBar(const SnackBar(content: Text('Marked as ready')));
                                    },
                                    icon: const Icon(Icons.check_circle_outline),
                                  ),
                                if (status == 'CUSTOMER_REJECTED')
                                  IconButton.filledTonal(
                                    tooltip: 'Respond',
                                    onPressed: () async {
                                      final messenger = ScaffoldMessenger.of(context);
                                      final msg = await _promptMessage(title: 'Respond to rejection', hint: 'Write response...');
                                      if (msg == null) return;
                                      await ref.read(staffOrdersProvider.notifier).staffRespond(orderId: o.id, message: msg);
                                      if (!mounted) return;
                                      messenger.showSnackBar(const SnackBar(content: Text('Response sent')));
                                    },
                                    icon: const Icon(Icons.reply_outlined),
                                  ),
                                if (canDelete)
                                  IconButton(
                                    tooltip: 'Delete',
                                    onPressed: () async {
                                      final messenger = ScaffoldMessenger.of(context);
                                      final ok = await _confirmDelete(
                                        title: 'Delete order?',
                                        message: 'Delete this order permanently? This cannot be undone.',
                                      );
                                      if (!ok) return;
                                      await ref.read(staffOrdersProvider.notifier).deleteOrder(o.id);
                                      if (!mounted) return;
                                      messenger.showSnackBar(const SnackBar(content: Text('Order deleted')));
                                    },
                                    icon: const Icon(Icons.delete_outline, color: Color(0xFFC62828)),
                                  ),
                                if (canTransfer)
                                  IconButton(
                                    tooltip: 'Transfer',
                                    onPressed: () async {
                                      final messenger = ScaffoldMessenger.of(context);
                                      final picked = await _pickCentre(currentCentreId: o.serviceCentre?.id);
                                      if (picked == null) return;
                                      await ref.read(staffOrdersProvider.notifier).transferOrder(orderId: o.id, serviceCentreId: picked.id);
                                      if (!mounted) return;
                                      messenger.showSnackBar(SnackBar(content: Text('Transferred to ${picked.centreName}')));
                                    },
                                    icon: const Icon(Icons.swap_horiz),
                                  ),
                              ],
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

class _TransferCentreSheet extends ConsumerStatefulWidget {
  final String? currentCentreId;
  const _TransferCentreSheet({required this.currentCentreId});

  @override
  ConsumerState<_TransferCentreSheet> createState() => _TransferCentreSheetState();
}

class _TransferCentreSheetState extends ConsumerState<_TransferCentreSheet> {
  final _search = TextEditingController();
  bool _loading = false;
  String? _err;
  List<ServiceCentre> _centres = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _err = null;
    });
    try {
      final list = await ref.read(catalogRepositoryProvider).activeServiceCentres(search: _search.text.trim());
      final filtered = list.where((c) => c.id != widget.currentCentreId).toList();
      if (!mounted) return;
      setState(() => _centres = filtered);
    } catch (e) {
      if (!mounted) return;
      setState(() => _err = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final h = MediaQuery.of(context).size.height;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: SizedBox(
        height: h * 0.75,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Transfer to service centre', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _load(),
                    decoration: InputDecoration(
                      labelText: 'Search centre',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: IconButton(
                        tooltip: 'Search',
                        onPressed: _loading ? null : _load,
                        icon: const Icon(Icons.arrow_forward),
                      ),
                    ),
                  ),
                  if (_err != null) ...[
                    const SizedBox(height: 10),
                    Text(_err!, style: const TextStyle(color: Color(0xFFC62828), fontWeight: FontWeight.w800)),
                  ],
                ],
              ),
            ),
            if (_loading) const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: LoadingView()) else const SizedBox.shrink(),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                itemCount: _centres.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final c = _centres[i];
                  return Card(
                    child: ListTile(
                      title: Text(c.centreName, style: const TextStyle(fontWeight: FontWeight.w900)),
                      subtitle: Text((c.locationName ?? '').trim().isEmpty ? '—' : c.locationName!),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.of(context).pop(c),
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

class _FilterChip extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ActionChip(
        label: Text(label),
        onPressed: onTap,
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  final bool isTransferred;
  const _StatusBadge({required this.status, required this.isTransferred});

  factory _StatusBadge.fromOrder(Order o) {
    final transferred = (o.transferredAt ?? '').trim().isNotEmpty;
    return _StatusBadge(status: o.status, isTransferred: transferred);
  }

  @override
  Widget build(BuildContext context) {
    final effectiveText = (isTransferred && status == 'COMPLETED') ? 'T.order' : null;
    final (color, text) = switch (status) {
      'PENDING' => (const Color(0xFFFFB300), 'Pending'),
      'STAFF_COMPLETED' => (const Color(0xFF2E7D32), 'Ready'),
      'COMPLETED' => (const Color(0xFF2E7D32), effectiveText ?? 'Completed'),
      'CUSTOMER_REJECTED' => (const Color(0xFFC62828), 'Rejected'),
      'CANCELLED' => (Colors.black54, 'Cancelled'),
      _ => (Colors.black54, status),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999), border: Border.all(color: color.withValues(alpha: 0.25))),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (effectiveText != null) ...[
            Icon(Icons.check_circle, size: 14, color: color),
            const SizedBox(width: 6),
          ],
          Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12)),
        ],
      ),
    );
  }
}
