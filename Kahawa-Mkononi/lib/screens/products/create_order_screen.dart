import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/order.dart';
import '../../providers/orders_provider.dart';
import '../../providers/products_provider.dart';
import '../../providers/service_centres_provider.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/error_view.dart';
import '../../widgets/loading_view.dart';

class CreateOrderScreen extends ConsumerStatefulWidget {
  final String? editOrderId;
  const CreateOrderScreen({super.key, this.editOrderId});

  @override
  ConsumerState<CreateOrderScreen> createState() => _CreateOrderScreenState();
}

class _CreateOrderScreenState extends ConsumerState<CreateOrderScreen> {
  String? _productId;
  String? _centreId;
  int _qty = 1;
  bool _saving = false;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final qp = GoRouterState.of(context).uri.queryParameters;
    final productFromQuery = qp['productId'];
    if (_productId == null && productFromQuery != null && productFromQuery.trim().isNotEmpty) {
      _productId = productFromQuery.trim();
    }
  }

  Future<Order?> _findEditOrder() async {
    final id = widget.editOrderId;
    if (id == null) return null;
    final current = ref.read(ordersProvider).valueOrNull;
    final found = current?.where((o) => o.id == id).toList().firstOrNull;
    if (found != null) return found;
    await ref.read(ordersProvider.notifier).reload();
    final next = ref.read(ordersProvider).valueOrNull;
    return next?.where((o) => o.id == id).toList().firstOrNull;
  }

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(productsProvider);
    final centres = ref.watch(serviceCentresProvider);
    final editing = widget.editOrderId != null;

    return Scaffold(
      appBar: BrandedAppBar(title: Text(editing ? 'Edit order' : 'New order')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: products.when(
            loading: () => const LoadingView(),
            error: (e, _) => ErrorView(title: 'Failed to load products', details: e.toString(), onRetry: () => ref.read(productsProvider.notifier).reload()),
            data: (productList) {
              if (productList.isEmpty) return const ErrorView(title: 'No products available');
              return centres.when(
                loading: () => const LoadingView(),
                error: (e, _) => ErrorView(title: 'Failed to load service centres', details: e.toString(), onRetry: () => ref.read(serviceCentresProvider.notifier).reload()),
                data: (centreList) {
                  if (centreList.isEmpty) return const ErrorView(title: 'No service centres available');
                  return FutureBuilder<Order?>(
                    future: _findEditOrder(),
                    builder: (context, snap) {
                      final editOrder = editing ? snap.data : null;
                      if (editing && snap.connectionState != ConnectionState.done) {
                        return const LoadingView();
                      }

                      final initialProductId = editOrder?.items.firstOrNull?.product.id;
                      final initialCentreId = editOrder?.serviceCentre?.id;
                      _productId ??= initialProductId ?? productList.first.id;
                      _centreId ??= initialCentreId ?? centreList.first.id;
                      _qty = _qty.clamp(1, 1000);

                      final selectedProduct = productList.firstWhere((p) => p.id == _productId, orElse: () => productList.first);
                      final selectedCentre = centreList.firstWhere((c) => c.id == _centreId, orElse: () => centreList.first);

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Product', style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 8),
                                  DropdownButtonFormField<String>(
                                    initialValue: _productId,
                                    items: productList.map((p) => DropdownMenuItem(value: p.id, child: Text('${p.name} • ${p.price} ${p.currency}'))).toList(),
                                    onChanged: _saving ? null : (v) => setState(() => _productId = v),
                                  ),
                                  const SizedBox(height: 12),
                                  Text('Service centre', style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 8),
                                  DropdownButtonFormField<String>(
                                    initialValue: _centreId,
                                    items: centreList.map((c) => DropdownMenuItem(value: c.id, child: Text('${c.centreName}${(c.locationName ?? '').isEmpty ? '' : ' • ${c.locationName}'}'))).toList(),
                                    onChanged: _saving ? null : (v) => setState(() => _centreId = v),
                                  ),
                                  const SizedBox(height: 12),
                                  Text('Quantity', style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      IconButton(
                                        onPressed: _saving ? null : () => setState(() => _qty = (_qty - 1).clamp(1, 1000)),
                                        icon: const Icon(Icons.remove_circle_outline),
                                      ),
                                      Expanded(
                                        child: Center(
                                          child: Text('$_qty', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                                        ),
                                      ),
                                      IconButton(
                                        onPressed: _saving ? null : () => setState(() => _qty = (_qty + 1).clamp(1, 1000)),
                                        icon: const Icon(Icons.add_circle_outline),
                                      ),
                                    ],
                                  ),
                                  const Divider(height: 18),
                                  Text('Summary', style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 6),
                                  Text('${selectedProduct.name} x$_qty'),
                                  Text('Centre: ${selectedCentre.centreName}'),
                                ],
                              ),
                            ),
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 10),
                            Text(_error!, style: const TextStyle(color: Color(0xFFC62828), fontWeight: FontWeight.w700)),
                          ],
                          const Spacer(),
                          ElevatedButton.icon(
                            onPressed: _saving
                                ? null
                                : () async {
                                    if (_productId == null || _centreId == null) return;
                                    setState(() {
                                      _saving = true;
                                      _error = null;
                                    });
                                    try {
                                      if (editing) {
                                        await ref.read(ordersProvider.notifier).updateOrder(orderId: widget.editOrderId!, productId: _productId, quantity: _qty, serviceCentreId: _centreId);
                                        if (context.mounted) context.pop();
                                      } else {
                                        final created = await ref.read(ordersProvider.notifier).create(productId: _productId!, quantity: _qty, serviceCentreId: _centreId!);
                                        if (context.mounted) context.go('/orders/${created.id}');
                                      }
                                    } catch (e) {
                                      setState(() => _error = e.toString());
                                    } finally {
                                      if (mounted) setState(() => _saving = false);
                                    }
                                  },
                            icon: Icon(editing ? Icons.save_outlined : Icons.check_circle_outline),
                            label: Text(_saving ? 'Saving...' : (editing ? 'Save changes' : 'Place order')),
                          ),
                        ],
                      );
                    },
                  );
                },
              );
            },
          ),
        ),
      ),
    );
  }
}

extension _FirstOrNull<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
