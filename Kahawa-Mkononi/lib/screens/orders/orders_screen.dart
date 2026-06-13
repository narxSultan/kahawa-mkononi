import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/order.dart';
import '../../providers/orders_provider.dart';
import '../../utils/formatters.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/empty_view.dart';
import '../../widgets/error_view.dart';
import '../../widgets/loading_view.dart';

class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  final Set<String> _selected = <String>{};
  bool _selecting = false;

  bool _canDeleteStatus(String status) => status == 'COMPLETED' || status == 'CUSTOMER_REJECTED' || status == 'CANCELLED';

  void _toggleSelection(String id) {
    setState(() {
      if (_selected.contains(id)) {
        _selected.remove(id);
      } else {
        _selected.add(id);
      }
      if (_selected.isEmpty) _selecting = false;
    });
  }

  void _enterSelection(String id) {
    setState(() {
      _selecting = true;
      _selected.add(id);
    });
  }

  void _exitSelection() {
    setState(() {
      _selecting = false;
      _selected.clear();
    });
  }

  Future<bool> _confirmDelete({required int count}) async {
    return (await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Delete orders?'),
            content: Text(count == 1 ? 'This will permanently delete the selected order.' : 'This will permanently delete $count selected orders.'),
            actions: [
              TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
              FilledButton.tonal(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Delete')),
            ],
          ),
        )) ??
        false;
  }

  Future<void> _deleteSelected() async {
    final ids = _selected.toList();
    if (ids.isEmpty) return;
    final ok = await _confirmDelete(count: ids.length);
    if (!ok) return;
    await ref.read(ordersProvider.notifier).deleteMany(ids);
    if (!mounted) return;
    _exitSelection();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ids.length == 1 ? 'Order deleted' : '${ids.length} orders deleted')));
  }

  Future<void> _deleteOne(String orderId) async {
    final ok = await _confirmDelete(count: 1);
    if (!ok) return;
    await ref.read(ordersProvider.notifier).delete(orderId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Order deleted')));
  }

  @override
  Widget build(BuildContext context) {
    final orders = ref.watch(ordersProvider);

    return Scaffold(
      appBar: BrandedAppBar(
        title: Text(_selecting ? '${_selected.length} selected' : 'My orders'),
        actions: [
          if (_selecting) ...[
            IconButton(
              tooltip: 'Delete selected',
              onPressed: _selected.isEmpty ? null : _deleteSelected,
              icon: const Icon(Icons.delete_outline),
            ),
            IconButton(
              tooltip: 'Cancel selection',
              onPressed: _exitSelection,
              icon: const Icon(Icons.close),
            ),
          ] else ...[
            IconButton(
              tooltip: 'Delete orders',
              onPressed: () => setState(() => _selecting = true),
              icon: const Icon(Icons.delete_outline),
            ),
          ]
        ],
      ),
      floatingActionButton: _selecting
          ? null
          : FloatingActionButton.extended(
              onPressed: () => context.push('/app/order/new'),
              icon: const Icon(Icons.add),
              label: const Text('New'),
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
                  _FilterChip(
                    label: 'All',
                    onTap: () {
                      if (_selecting) _exitSelection();
                      ref.read(ordersProvider.notifier).filterStatus(null);
                    },
                  ),
                  _FilterChip(
                    label: 'Pending',
                    onTap: () {
                      if (_selecting) _exitSelection();
                      ref.read(ordersProvider.notifier).filterStatus('PENDING');
                    },
                  ),
                  _FilterChip(
                    label: 'Ready',
                    onTap: () {
                      if (_selecting) _exitSelection();
                      ref.read(ordersProvider.notifier).filterStatus('STAFF_COMPLETED');
                    },
                  ),
                  _FilterChip(
                    label: 'Completed',
                    onTap: () {
                      if (_selecting) _exitSelection();
                      ref.read(ordersProvider.notifier).filterStatus('COMPLETED');
                    },
                  ),
                  _FilterChip(
                    label: 'Rejected',
                    onTap: () {
                      if (_selecting) _exitSelection();
                      ref.read(ordersProvider.notifier).filterStatus('CUSTOMER_REJECTED');
                    },
                  ),
                  _FilterChip(
                    label: 'Cancelled',
                    onTap: () {
                      if (_selecting) _exitSelection();
                      ref.read(ordersProvider.notifier).filterStatus('CANCELLED');
                    },
                  ),
                ],
              ),
            ),
            Expanded(
              child: orders.when(
                loading: () => const LoadingView(),
                error: (e, _) => ErrorView(title: 'Failed to load orders', details: e.toString(), onRetry: () => ref.read(ordersProvider.notifier).reload()),
                data: (list) {
                  if (list.isEmpty) {
                    return const EmptyView(title: 'No orders yet', subtitle: 'Create your first order to get started.');
                  }
                  return RefreshIndicator(
                    onRefresh: () async => ref.read(ordersProvider.notifier).reload(),
                    child: ListView.separated(
                      padding: EdgeInsets.fromLTRB(16, 8, 16, _selecting ? 16 : 90),
                      itemCount: list.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final o = list[i];
                        final centre = o.serviceCentre?.centreName ?? '—';
                        final deletable = _canDeleteStatus(o.status);
                        final editable = o.status == 'PENDING';
                        final selected = _selected.contains(o.id);

                        return Card(
                          child: ListTile(
                            onTap: () {
                              if (_selecting) {
                                if (!deletable) return;
                                _toggleSelection(o.id);
                                return;
                              }
                              context.push('/orders/${o.id}');
                            },
                            onLongPress: deletable ? () => _enterSelection(o.id) : null,
                            leading: _selecting
                                ? Checkbox(
                                    value: selected,
                                    onChanged: deletable ? (_) => _toggleSelection(o.id) : null,
                                  )
                                : null,
                            title: Text('Order ${o.id.substring(0, 6)}', style: const TextStyle(fontWeight: FontWeight.w900)),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 4),
                                Text('Centre: $centre'),
                                Text('Total: ${o.totalAmount} ${o.currency}'),
                                Text('Created: ${Formatters.dateTime(o.createdAt)}', style: const TextStyle(color: Colors.black54)),
                              ],
                            ),
                            trailing: _selecting
                                ? _StatusBadge.fromOrder(o)
                                : Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      _StatusBadge.fromOrder(o),
                                      if (editable)
                                        IconButton(
                                          tooltip: 'Edit order',
                                          onPressed: () => context.push('/orders/${o.id}/edit'),
                                          icon: const Icon(Icons.edit_outlined),
                                        ),
                                      if (deletable)
                                        IconButton(
                                          tooltip: 'Delete',
                                          onPressed: () => _deleteOne(o.id),
                                          icon: const Icon(Icons.delete_outline),
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

class _FilterChip extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ActionChip(label: Text(label), onPressed: onTap),
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
