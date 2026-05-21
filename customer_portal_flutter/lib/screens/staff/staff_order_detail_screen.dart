import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/order.dart';
import '../../providers/staff_orders_provider.dart';
import '../../utils/app_config.dart';
import '../../utils/formatters.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/loading_view.dart';

class StaffOrderDetailScreen extends ConsumerStatefulWidget {
  final String orderId;
  const StaffOrderDetailScreen({super.key, required this.orderId});

  @override
  ConsumerState<StaffOrderDetailScreen> createState() => _StaffOrderDetailScreenState();
}

class _StaffOrderDetailScreenState extends ConsumerState<StaffOrderDetailScreen> {
  Future<Order?> _find() async {
    final existing = ref.read(staffOrdersProvider).valueOrNull;
    final found = existing?.where((o) => o.id == widget.orderId).toList().firstOrNull;
    if (found != null) return found;
    await ref.read(staffOrdersProvider.notifier).reload();
    final next = ref.read(staffOrdersProvider).valueOrNull;
    return next?.where((o) => o.id == widget.orderId).toList().firstOrNull;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Order?>(
      future: _find(),
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) return const Scaffold(body: LoadingView());
        final o = snap.data;
        if (o == null) {
          return const Scaffold(
            appBar: BrandedAppBar(title: Text('Order')),
            body: Center(child: Text('Order not found')),
          );
        }
        final cust = o.customer;
        final canDelete = o.status == 'COMPLETED' || o.status == 'CUSTOMER_REJECTED' || o.status == 'CANCELLED';

        return Scaffold(
          appBar: BrandedAppBar(
            title: Text('Order ${o.id.substring(0, 6)}'),
            actions: [
              if (canDelete)
                IconButton(
                  tooltip: 'Delete',
                  onPressed: () async {
                    final messenger = ScaffoldMessenger.of(context);
                    final navigator = Navigator.of(context);
                    final ok = await showDialog<bool>(
                      context: context,
                      barrierDismissible: false,
                      builder: (c) => AlertDialog(
                        title: const Text('Delete order?'),
                        content: const Text('Delete this order permanently? This cannot be undone.'),
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
                    if (ok != true) return;
                    await ref.read(staffOrdersProvider.notifier).deleteOrder(o.id);
                    if (!mounted) return;
                    messenger.showSnackBar(const SnackBar(content: Text('Order deleted')));
                    navigator.pop();
                  },
                  icon: const Icon(Icons.delete_outline, color: Color(0xFFC62828)),
                ),
            ],
          ),
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(child: Text('Status: ${o.status}', style: const TextStyle(fontWeight: FontWeight.w900))),
                            _StatusChip(status: o.status, isTransferred: (o.transferredAt ?? '').trim().isNotEmpty),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text('Created: ${Formatters.dateTime(o.createdAt)}'),
                        Text('Updated: ${Formatters.dateTime(o.updatedAt)}'),
                        const SizedBox(height: 10),
                        Text('Service centre: ${o.serviceCentre?.centreName ?? '—'}', style: const TextStyle(fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                ),
                if (cust != null) ...[
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Customer', style: TextStyle(fontWeight: FontWeight.w900)),
                          const SizedBox(height: 6),
                          Text(cust.fullName),
                          if ((cust.phone ?? '').trim().isNotEmpty) Text('Phone: ${cust.phone}'),
                          if ((cust.email ?? '').trim().isNotEmpty) Text('Email: ${cust.email}'),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Text('Items', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                const SizedBox(height: 8),
                ...o.items.map(
                  (it) => Card(
                    child: ListTile(
                      leading: _ProductThumb(imageUrl: it.product.imageUrl),
                      title: Text(it.product.name, style: const TextStyle(fontWeight: FontWeight.w900)),
                      subtitle: Text('Qty: ${it.quantity}  •  ${it.lineTotal} ${o.currency}'),
                    ),
                  ),
                ),
                Card(
                  child: ListTile(
                    title: const Text('Total', style: TextStyle(fontWeight: FontWeight.w900)),
                    trailing: Text('${o.totalAmount} ${o.currency}', style: const TextStyle(fontWeight: FontWeight.w900)),
                  ),
                ),
                if ((o.customerRejectionReason ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Rejection reason', style: TextStyle(fontWeight: FontWeight.w900)),
                          const SizedBox(height: 6),
                          Text(o.customerRejectionReason!),
                        ],
                      ),
                    ),
                  ),
                ],
                if ((o.staffResponseMessage ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Staff response', style: TextStyle(fontWeight: FontWeight.w900)),
                          const SizedBox(height: 6),
                          Text(o.staffResponseMessage!),
                          if ((o.staffResponseAt ?? '').isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(Formatters.dateTime(o.staffResponseAt), style: const TextStyle(color: Colors.black54, fontSize: 12)),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
                if ((o.staffMessageText ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Last message to customer', style: TextStyle(fontWeight: FontWeight.w900)),
                          const SizedBox(height: 6),
                          Text(o.staffMessageText!),
                          if ((o.staffMessageAt ?? '').isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(Formatters.dateTime(o.staffMessageAt), style: const TextStyle(color: Colors.black54, fontSize: 12)),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ProductThumb extends StatelessWidget {
  final String? imageUrl;
  const _ProductThumb({required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    final abs = AppConfig.absUrl(imageUrl);
    if (abs.isEmpty) {
      return const CircleAvatar(
        backgroundColor: Color(0xFFF3F4F6),
        child: Icon(Icons.local_cafe_outlined, color: Colors.black54),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 44,
        height: 44,
        child: Image.network(
          abs,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            color: const Color(0xFFF3F4F6),
            alignment: Alignment.center,
            child: const Icon(Icons.broken_image_outlined, color: Colors.black54),
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  final bool isTransferred;
  const _StatusChip({required this.status, required this.isTransferred});

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

extension _FirstOrNull<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
