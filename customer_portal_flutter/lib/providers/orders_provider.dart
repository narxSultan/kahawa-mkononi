import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/order.dart';
import 'dependencies.dart';

class OrdersController extends AutoDisposeAsyncNotifier<List<Order>> {
  String? _status;

  @override
  Future<List<Order>> build() async {
    return ref.watch(orderRepositoryProvider).myOrders(status: _status);
  }

  Future<void> filterStatus(String? status) async {
    _status = status;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async => ref.read(orderRepositoryProvider).myOrders(status: _status));
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async => ref.read(orderRepositoryProvider).myOrders(status: _status));
  }

  Future<Order> create({required String productId, required int quantity, required String serviceCentreId}) async {
    final created = await ref.read(orderRepositoryProvider).createOrder(productId: productId, quantity: quantity, serviceCentreId: serviceCentreId);
    await reload();
    return created;
  }

  Future<void> cancel(String orderId) async {
    await ref.read(orderRepositoryProvider).cancelMyOrder(orderId);
    await reload();
  }

  Future<void> updateOrder({required String orderId, String? productId, int? quantity, String? serviceCentreId}) async {
    await ref.read(orderRepositoryProvider).updateMyOrder(orderId: orderId, productId: productId, quantity: quantity, serviceCentreId: serviceCentreId);
    await reload();
  }

  Future<void> acknowledge(String orderId) async {
    await ref.read(orderRepositoryProvider).acknowledgeOrder(orderId);
    await reload();
  }

  Future<void> reject({required String orderId, required String reason}) async {
    await ref.read(orderRepositoryProvider).rejectOrder(orderId: orderId, reason: reason);
    await reload();
  }

  Future<void> delete(String orderId) async {
    await ref.read(orderRepositoryProvider).deleteOrder(orderId);
    await reload();
  }

  Future<void> deleteMany(Iterable<String> orderIds) async {
    final ids = orderIds.toSet();
    if (ids.isEmpty) return;

    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncValue.data(current.where((o) => !ids.contains(o.id)).toList());
    }

    try {
      for (final id in ids) {
        await ref.read(orderRepositoryProvider).deleteOrder(id);
      }
    } finally {
      await reload();
    }
  }
}

final ordersProvider = AutoDisposeAsyncNotifierProvider<OrdersController, List<Order>>(OrdersController.new);
