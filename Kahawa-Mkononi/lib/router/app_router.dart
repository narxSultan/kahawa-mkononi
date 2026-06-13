import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_controller.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/auth/forgot_password_screen.dart';
import '../screens/splash_screen.dart';
import '../screens/shell/shell_screen.dart';
import '../screens/branding/admin_branding_screen.dart';
import '../screens/staff/staff_shell_screen.dart';
import '../screens/staff/staff_order_detail_screen.dart';
import '../screens/dashboard/dashboard_screen.dart';
import '../screens/orders/orders_screen.dart';
import '../screens/orders/order_detail_screen.dart';
import '../screens/products/products_screen.dart';
import '../screens/products/create_order_screen.dart';
import '../screens/notifications/notifications_screen.dart';
import '../screens/notifications/notification_detail_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/feedback/feedback_screen.dart';
import 'go_router_refresh_stream.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider);
  final stream = StreamController<void>();
  ref.onDispose(stream.close);
  ref.listen<AuthState>(authControllerProvider, (_, __) => stream.add(null));

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: GoRouterRefreshStream(stream.stream),
    redirect: (context, state) {
      final loggingIn = state.matchedLocation == '/login' || state.matchedLocation == '/register' || state.matchedLocation == '/forgot';
      final onSplash = state.matchedLocation == '/splash';
      final onAdmin = state.matchedLocation == '/admin';
      final onStaff = state.matchedLocation.startsWith('/staff');
      final role = auth.user?.roleName ?? '';
      final isCustomer = role == 'CUSTOMER';
      final isStaffApp = role == 'ADMIN' || role == 'MANAGER' || role == 'STAFF';

      if (auth.status == AuthStatus.unknown) return onSplash ? null : '/splash';
      if (auth.status == AuthStatus.unauthenticated) return loggingIn ? null : '/login';
      if (auth.status == AuthStatus.authenticated) {
        if (isCustomer) {
          if (onAdmin) return '/app';
          return (loggingIn || onSplash) ? '/app' : null;
        }
        if (!isStaffApp) return '/login';
        // Staff/manager/admin: route to staff console.
        if (onAdmin) return role == 'ADMIN' ? null : '/staff';
        return (loggingIn || onSplash || !onStaff) ? '/staff' : null;
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (c, s) => const SplashScreen()),
      GoRoute(path: '/login', builder: (c, s) => const LoginScreen()),
      GoRoute(path: '/register', builder: (c, s) => const RegisterScreen()),
      GoRoute(path: '/forgot', builder: (c, s) => const ForgotPasswordScreen()),
      GoRoute(path: '/admin', builder: (c, s) => const AdminBrandingScreen()),
      GoRoute(
        path: '/staff',
        builder: (c, s) => const StaffShellScreen(),
        routes: [
          GoRoute(
            path: 'orders/:id',
            builder: (c, s) => StaffOrderDetailScreen(orderId: s.pathParameters['id']!),
          ),
        ],
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => ShellScreen(shell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/app',
                pageBuilder: (c, s) => const NoTransitionPage(child: DashboardScreen()),
                routes: [
                  GoRoute(path: 'products', builder: (c, s) => const ProductsScreen()),
                  GoRoute(path: 'order/new', builder: (c, s) => const CreateOrderScreen()),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/orders',
                pageBuilder: (c, s) => const NoTransitionPage(child: OrdersScreen()),
                routes: [
                  GoRoute(
                    path: ':id',
                    builder: (c, s) => OrderDetailScreen(orderId: s.pathParameters['id']!),
                    routes: [
                      GoRoute(path: 'edit', builder: (c, s) => CreateOrderScreen(editOrderId: s.pathParameters['id']!)),
                      GoRoute(path: 'feedback', builder: (c, s) => FeedbackScreen(orderId: s.pathParameters['id']!)),
                    ],
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/notifications',
                pageBuilder: (c, s) => const NoTransitionPage(child: NotificationsScreen()),
                routes: [
                  GoRoute(path: ':id', builder: (c, s) => NotificationDetailScreen(notificationId: s.pathParameters['id']!)),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                pageBuilder: (c, s) => const NoTransitionPage(child: ProfileScreen()),
                routes: [
                  GoRoute(path: 'feedback', builder: (c, s) => const FeedbackScreen()),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
