import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/order.dart';
import '../../providers/orders_provider.dart';
import '../../utils/app_config.dart';
import '../../utils/formatters.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/loading_view.dart';

class OrderDetailScreen extends ConsumerStatefulWidget {
  final String orderId;
  const OrderDetailScreen({super.key, required this.orderId});

  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen> {
  bool _working = false;
  final _replyCtrl = TextEditingController();

  Future<Order?> _findOrder() async {
    final existing = ref.read(ordersProvider).valueOrNull;
    final found = existing?.where((o) => o.id == widget.orderId).toList().firstOrNull;
    if (found != null) return found;
    await ref.read(ordersProvider.notifier).reload();
    final next = ref.read(ordersProvider).valueOrNull;
    return next?.where((o) => o.id == widget.orderId).toList().firstOrNull;
  }

  Future<void> _confirmCancel(Order o) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Cancel order?'),
        content: const Text('This will cancel your pending order.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('No')),
          ElevatedButton(onPressed: () => Navigator.of(c).pop(true), child: const Text('Yes, cancel')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _working = true);
    try {
      await ref.read(ordersProvider.notifier).cancel(o.id);
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _confirmAcknowledge(Order o) async {
    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (c) => AlertDialog(
        title: const Text('Confirm order complete'),
        content: const Text('If everything is okay, confirm completion.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Not yet')),
          ElevatedButton(onPressed: () => Navigator.of(c).pop(true), child: const Text('Confirm')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _working = true);
    try {
      await ref.read(ordersProvider.notifier).acknowledge(o.id);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (c) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.check_circle, color: Color(0xFF2E7D32)),
              SizedBox(width: 10),
              Text('Order complete'),
            ],
          ),
          content: const Text('Thank you! Your order is marked as completed.'),
          actions: [
            ElevatedButton(onPressed: () => Navigator.of(c).pop(), child: const Text('OK')),
          ],
        ),
      );
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _reject(Order o) async {
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (c) => AlertDialog(
        title: const Text('Reject order'),
        content: TextField(
          controller: ctrl,
          maxLines: 4,
          decoration: const InputDecoration(hintText: 'Tell us what is wrong...'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.of(c).pop(true), child: const Text('Send')),
        ],
      ),
    );
    final reason = ctrl.text.trim();
    ctrl.dispose();
    if (ok != true) return;
    if (reason.isEmpty) return;
    setState(() => _working = true);
    try {
      await ref.read(ordersProvider.notifier).reject(orderId: o.id, reason: reason);
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _sendReply(Order o) async {
    final msg = _replyCtrl.text.trim();
    if (msg.isEmpty) return;
    setState(() => _working = true);
    try {
      await ref.read(ordersProvider.notifier).replyToOrderMessage(orderId: o.id, message: msg);
      _replyCtrl.clear();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Reply sent')));
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  @override
  void dispose() {
    _replyCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Order?>(
      future: _findOrder(),
      builder: (context, snap) {
        final o = snap.data;
        if (snap.connectionState != ConnectionState.done) {
          return const Scaffold(body: LoadingView());
        }
        if (o == null) {
          return const Scaffold(
            appBar: BrandedAppBar(title: Text('Order')),
            body: Center(child: Text('Order not found')),
          );
        }
        final hasStaffThread =
            (o.staffMessageText ?? '').trim().isNotEmpty || (o.staffResponseMessage ?? '').trim().isNotEmpty;

        return Scaffold(
          appBar: BrandedAppBar(title: Text('Order ${o.id.substring(0, 6)}')),
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
                        const SizedBox(height: 6),
                        Text('Created: ${Formatters.dateTime(o.createdAt)}'),
                        Text('Updated: ${Formatters.dateTime(o.updatedAt)}'),
                        const SizedBox(height: 10),
                        Text('Service centre: ${o.serviceCentre?.centreName ?? '—'}', style: const TextStyle(fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                ),
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
                const SizedBox(height: 12),
                if ((o.staffMessageText ?? '').trim().isNotEmpty)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Staff message', style: TextStyle(fontWeight: FontWeight.w900)),
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
                if (hasStaffThread) ...[
                  if ((o.customerMessageText ?? '').trim().isNotEmpty)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Your reply', style: TextStyle(fontWeight: FontWeight.w900)),
                            const SizedBox(height: 6),
                            Text(o.customerMessageText!),
                            if ((o.customerMessageAt ?? '').isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text(Formatters.dateTime(o.customerMessageAt), style: const TextStyle(color: Colors.black54, fontSize: 12)),
                              ),
                          ],
                        ),
                      ),
                    ),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Reply to staff', style: TextStyle(fontWeight: FontWeight.w900)),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _replyCtrl,
                            minLines: 1,
                            maxLines: 4,
                            decoration: const InputDecoration(
                              hintText: 'Type your reply...',
                              border: OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              const Spacer(),
                              ElevatedButton.icon(
                                onPressed: _working ? null : () => _sendReply(o),
                                icon: const Icon(Icons.send_outlined),
                                label: const Text('Send'),
                              ),
                            ],
                          )
                        ],
                      ),
                    ),
                  ),
                ],
                if ((o.staffResponseMessage ?? '').trim().isNotEmpty)
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
                const SizedBox(height: 16),
                if (_working) const Padding(padding: EdgeInsets.all(6), child: LinearProgressIndicator()),
                _Actions(
                  order: o,
                  disabled: _working,
                  onEdit: () => context.push('/orders/${o.id}/edit'),
                  onCancel: () => _confirmCancel(o),
                  onAcknowledge: () => _confirmAcknowledge(o),
                  onReject: () => _reject(o),
                  onFeedback: () => context.push('/orders/${o.id}/feedback'),
                ),
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

class _Actions extends StatelessWidget {
  final Order order;
  final bool disabled;
  final VoidCallback onEdit;
  final VoidCallback onCancel;
  final VoidCallback onAcknowledge;
  final VoidCallback onReject;
  final VoidCallback onFeedback;

  const _Actions({
    required this.order,
    required this.disabled,
    required this.onEdit,
    required this.onCancel,
    required this.onAcknowledge,
    required this.onReject,
    required this.onFeedback,
  });

  @override
  Widget build(BuildContext context) {
    final s = order.status;
    if (s == 'PENDING') {
      return Row(
        children: [
          Expanded(child: OutlinedButton.icon(onPressed: disabled ? null : onEdit, icon: const Icon(Icons.edit_outlined), label: const Text('Edit'))),
          const SizedBox(width: 10),
          Expanded(child: ElevatedButton.icon(onPressed: disabled ? null : onCancel, icon: const Icon(Icons.cancel_outlined), label: const Text('Cancel'))),
        ],
      );
    }
    if (s == 'STAFF_COMPLETED') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ElevatedButton.icon(onPressed: disabled ? null : onAcknowledge, icon: const Icon(Icons.check_circle_outline), label: const Text('Confirm order complete')),
          const SizedBox(height: 10),
          OutlinedButton.icon(onPressed: disabled ? null : onReject, icon: const Icon(Icons.report_problem_outlined), label: const Text('Reject')),
        ],
      );
    }
    if (s == 'COMPLETED') {
      return ElevatedButton.icon(onPressed: disabled ? null : onFeedback, icon: const Icon(Icons.star_outline), label: const Text('Rate this order'));
    }
    return const SizedBox.shrink();
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
      'STAFF_COMPLETED' => (const Color(0xFF2E7D32), 'Order complete'),
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
