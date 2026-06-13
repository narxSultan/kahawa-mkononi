import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/order.dart';
import 'dependencies.dart';

class StaffOrdersController extends AutoDisposeAsyncNotifier<List<Order>> {
  String? _status;

  @override
  Future<List<Order>> build() async {
    return ref.watch(orderRepositoryProvider).centreOrders(status: _status);
  }

  Future<void> filterStatus(String? status) async {
    _status = status;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async => ref.read(orderRepositoryProvider).centreOrders(status: _status));
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async => ref.read(orderRepositoryProvider).centreOrders(status: _status));
  }

  Future<void> staffComplete(String orderId) async {
    await ref.read(orderRepositoryProvider).staffComplete(orderId);
    await reload();
  }

  Future<void> staffMessage({required String orderId, required String message}) async {
    await ref.read(orderRepositoryProvider).staffMessage(orderId: orderId, message: message);
    await reload();
  }

  Future<void> staffRespond({required String orderId, required String message}) async {
    await ref.read(orderRepositoryProvider).staffRespondRejection(orderId: orderId, message: message);
    await reload();
  }

  Future<void> deleteOrder(String orderId) async {
    await ref.read(orderRepositoryProvider).deleteOrder(orderId);
    await reload();
  }

  Future<void> transferOrder({required String orderId, required String serviceCentreId}) async {
    await ref.read(orderRepositoryProvider).transferOrder(orderId: orderId, serviceCentreId: serviceCentreId);
    await reload();
  }
}

final staffOrdersProvider = AutoDisposeAsyncNotifierProvider<StaffOrdersController, List<Order>>(StaffOrdersController.new);
