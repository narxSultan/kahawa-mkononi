import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/products_provider.dart';
import '../../utils/app_config.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/empty_view.dart';
import '../../widgets/error_view.dart';
import '../../widgets/loading_view.dart';

class ProductsScreen extends ConsumerStatefulWidget {
  const ProductsScreen({super.key});

  @override
  ConsumerState<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends ConsumerState<ProductsScreen> {
  final _search = TextEditingController();

  Widget _productThumb(String? imageUrl) {
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
        width: 48,
        height: 48,
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

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(productsProvider);
    return Scaffold(
      appBar: const BrandedAppBar(title: Text('Products')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                controller: _search,
                decoration: InputDecoration(
                  hintText: 'Search products...',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: IconButton(
                    onPressed: () {
                      _search.clear();
                      ref.read(productsProvider.notifier).search('');
                    },
                    icon: const Icon(Icons.close),
                  ),
                ),
                onSubmitted: (v) => ref.read(productsProvider.notifier).search(v),
              ),
            ),
            Expanded(
              child: products.when(
                loading: () => const LoadingView(),
                error: (e, _) => ErrorView(title: 'Failed to load products', details: e.toString(), onRetry: () => ref.read(productsProvider.notifier).reload()),
                data: (list) {
                  if (list.isEmpty) return const EmptyView(title: 'No products found', subtitle: 'Try a different search.');
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final p = list[i];
                      return Card(
                        child: ListTile(
                          leading: _productThumb(p.imageUrl),
                          title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w900)),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 4),
                              Text('${p.price} ${p.currency}'),
                              if ((p.description ?? '').trim().isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text(p.description!, maxLines: 2, overflow: TextOverflow.ellipsis),
                                ),
                            ],
                          ),
                          trailing: ElevatedButton(
                            onPressed: () => context.push('/app/order/new?productId=${p.id}'),
                            child: const Text('Order'),
                          ),
                        ),
                      );
                    },
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
