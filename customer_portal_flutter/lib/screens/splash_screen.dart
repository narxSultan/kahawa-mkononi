import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/auth_controller.dart';
import '../providers/branding_provider.dart';
import '../utils/app_config.dart';
import '../widgets/loading_view.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(authControllerProvider.notifier).init());
    // Start branding fetch early so the logo appears as soon as possible.
    Future.microtask(() => ref.read(appLogoUrlProvider.future));
  }

  @override
  Widget build(BuildContext context) {
    final logo = ref.watch(appLogoUrlProvider).valueOrNull;
    final logoAbs = AppConfig.absUrl(logo);

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          Opacity(
            opacity: 0.09,
            child: Center(
              child: logoAbs.isEmpty
                  ? const Icon(Icons.local_cafe_outlined, size: 220, color: Colors.black54)
                  : Image.network(
                      logoAbs,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const Icon(Icons.local_cafe_outlined, size: 220, color: Colors.black54),
                    ),
            ),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(22),
                    child: SizedBox(
                      width: 88,
                      height: 88,
                      child: logoAbs.isEmpty
                          ? Container(
                              color: const Color(0xFFF3F4F6),
                              alignment: Alignment.center,
                              child: const Icon(Icons.local_cafe_outlined, color: Colors.black54, size: 36),
                            )
                          : Image.network(
                              logoAbs,
                              fit: BoxFit.contain,
                              errorBuilder: (_, __, ___) => Container(
                                color: const Color(0xFFF3F4F6),
                                alignment: Alignment.center,
                                child: const Icon(Icons.local_cafe_outlined, color: Colors.black54, size: 36),
                              ),
                            ),
                    ),
                  ),
                ),
                const LoadingView(label: 'Loading...'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
