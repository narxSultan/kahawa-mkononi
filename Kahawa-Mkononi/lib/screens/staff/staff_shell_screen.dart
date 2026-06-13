import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/auth_controller.dart';
import '../profile/profile_screen.dart';
import 'staff_orders_screen.dart';
import 'staff_products_screen.dart';

class StaffShellScreen extends ConsumerStatefulWidget {
  const StaffShellScreen({super.key});

  @override
  ConsumerState<StaffShellScreen> createState() => _StaffShellScreenState();
}

class _StaffShellScreenState extends ConsumerState<StaffShellScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(authControllerProvider).user?.roleName ?? '';

    final body = switch (_tab) {
      0 => const StaffOrdersScreen(),
      1 => const StaffProductsScreen(),
      _ => const ProfileScreen(),
    };

    return Scaffold(
      body: body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Orders'),
          NavigationDestination(icon: Icon(Icons.local_cafe_outlined), selectedIcon: Icon(Icons.local_cafe), label: 'Products'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
      floatingActionButton: role == 'ADMIN'
          ? FloatingActionButton.small(
              tooltip: 'Branding',
              onPressed: () => context.go('/admin'),
              child: const Icon(Icons.palette_outlined),
            )
          : null,
    );
  }
}
