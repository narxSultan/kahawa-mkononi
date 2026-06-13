import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/product.dart';
import 'dependencies.dart';

class ProductsController extends AutoDisposeAsyncNotifier<List<Product>> {
  String _search = '';

  @override
  Future<List<Product>> build() async {
    final repo = ref.watch(catalogRepositoryProvider);
    return repo.products(search: _search);
  }

  Future<void> search(String value) async {
    _search = value;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async => ref.read(catalogRepositoryProvider).products(search: _search));
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async => ref.read(catalogRepositoryProvider).products(search: _search));
  }
}

final productsProvider = AutoDisposeAsyncNotifierProvider<ProductsController, List<Product>>(ProductsController.new);

