import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/order.dart';
import 'auth_controller.dart';
import 'dependencies.dart';

final pendingConfirmOrdersProvider = AutoDisposeFutureProvider<List<Order>>((ref) async {
  final auth = ref.watch(authControllerProvider);
  final role = auth.user?.roleName ?? '';
  if (auth.status != AuthStatus.authenticated) return const [];
  if (role != 'CUSTOMER') return const [];
  return ref.watch(orderRepositoryProvider).myOrders(status: 'STAFF_COMPLETED');
});

