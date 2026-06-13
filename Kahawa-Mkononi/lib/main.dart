import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'providers/branding_provider.dart';
import 'router/app_router.dart';
import 'utils/app_config.dart';
import 'utils/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: KahawaCustomerApp()));
}

class KahawaCustomerApp extends ConsumerWidget {
  const KahawaCustomerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final logoAbs = AppConfig.absUrl(ref.watch(appLogoUrlProvider).valueOrNull);
    return MaterialApp.router(
      title: 'KAHAWA MKONONI',
      theme: AppTheme.light(),
      routerConfig: router,
      builder: (context, child) {
        final c = child ?? const SizedBox.shrink();
        if (logoAbs.isEmpty) return c;
        return Stack(
          fit: StackFit.expand,
          children: [
            c,
            IgnorePointer(
              ignoring: true,
              child: Opacity(
                opacity: 0.03,
                child: Center(
                  child: FractionallySizedBox(
                    widthFactor: 0.78,
                    child: Image.network(
                      logoAbs,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
