import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/branding_provider.dart';
import '../utils/app_config.dart';

class BrandedBackground extends ConsumerWidget {
  final Widget child;
  final double opacity;
  const BrandedBackground({super.key, required this.child, this.opacity = 0.07});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logo = ref.watch(appLogoUrlProvider).valueOrNull;
    final logoAbs = AppConfig.absUrl(logo);

    return Stack(
      fit: StackFit.expand,
      children: [
        Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFF7F3EE), Color(0xFFFFFFFF)],
            ),
          ),
        ),
        if (logoAbs.isNotEmpty)
          IgnorePointer(
            ignoring: true,
            child: Opacity(
              opacity: opacity,
              child: Center(
                child: Image.network(
                  logoAbs,
                  width: 520,
                  height: 520,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
            ),
          ),
        child,
      ],
    );
  }
}

