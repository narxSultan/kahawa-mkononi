import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/product.dart';
import 'dependencies.dart';

class StaffProductsController extends AutoDisposeAsyncNotifier<List<Product>> {
  String _search = '';
  bool _showInactive = false;

  @override
  Future<List<Product>> build() async {
    return ref.watch(catalogRepositoryProvider).products(search: _search, onlyActive: !_showInactive);
  }

  bool get showInactive => _showInactive;

  Future<void> setShowInactive(bool value) async {
    if (_showInactive == value) return;
    _showInactive = value;
    await reload();
  }

  Future<void> search(String value) async {
    _search = value;
    await reload();
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      return ref.read(catalogRepositoryProvider).products(search: _search, onlyActive: !_showInactive);
    });
  }
}

final staffProductsProvider =
    AutoDisposeAsyncNotifierProvider<StaffProductsController, List<Product>>(StaffProductsController.new);

