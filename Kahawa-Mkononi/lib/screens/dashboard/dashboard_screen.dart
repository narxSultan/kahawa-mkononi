import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/auth_controller.dart';
import '../../providers/products_provider.dart';
import '../../utils/app_config.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/empty_view.dart';
import '../../widgets/error_view.dart';
import '../../widgets/loading_view.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final products = ref.watch(productsProvider);

    return Scaffold(
      appBar: const BrandedAppBar(title: Text('KAHAWA MKONONI')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            await ref.read(productsProvider.notifier).reload();
          },
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'Hello ${auth.customer?.fullName ?? auth.user?.fullName ?? ''}',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 6),
              Text('Order coffee fast from your phone.', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.black54)),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => context.push('/app/order/new'),
                      icon: const Icon(Icons.add_shopping_cart_outlined),
                      label: const Text('New order'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => context.push('/app/products'),
                      icon: const Icon(Icons.local_cafe_outlined),
                      label: const Text('Products'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text('Popular products', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
              const SizedBox(height: 10),
              products.when(
                loading: () => const SizedBox(height: 220, child: LoadingView()),
                error: (e, _) => SizedBox(height: 240, child: ErrorView(title: 'Failed to load products', details: e.toString(), onRetry: () => ref.read(productsProvider.notifier).reload())),
                data: (list) {
                  if (list.isEmpty) return const SizedBox(height: 220, child: EmptyView(title: 'No products yet', subtitle: 'Please check again later.'));
                  final take = list.take(6).toList();
                  return Column(
                    children: take
                        .map(
                          (p) => Card(
                            child: ListTile(
                              leading: _ProductThumb(imageUrl: p.imageUrl),
                              title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w900)),
                              subtitle: Text('${p.price} ${p.currency}'),
                              trailing: IconButton(
                                onPressed: () => context.push('/app/order/new'),
                                icon: const Icon(Icons.arrow_forward_ios_rounded, size: 18),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  );
                },
              ),
              const SizedBox(height: 6),
              TextButton.icon(
                onPressed: () => context.push('/app/products'),
                icon: const Icon(Icons.arrow_forward),
                label: const Text('View all products'),
              ),
            ],
          ),
        ),
      ),
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
      borderRadius: BorderRadius.circular(999),
      child: SizedBox(
        width: 40,
        height: 40,
        child: Image.network(
          abs,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            color: const Color(0xFFF3F4F6),
            alignment: Alignment.center,
            child: const Icon(Icons.broken_image_outlined, color: Colors.black54, size: 18),
          ),
        ),
      ),
    );
  }
}
