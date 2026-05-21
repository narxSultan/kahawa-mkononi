import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/branding_provider.dart';
import '../utils/app_config.dart';

class BrandedAppBar extends ConsumerWidget implements PreferredSizeWidget {
  final Widget title;
  final List<Widget>? actions;
  final Widget? leading;
  final bool centerTitle;
  final double logoOpacity;

  const BrandedAppBar({
    super.key,
    required this.title,
    this.actions,
    this.leading,
    this.centerTitle = false,
    this.logoOpacity = 0.18,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logoUrl = ref.watch(appLogoUrlProvider).valueOrNull;
    final logoAbs = AppConfig.absUrl(logoUrl);

    final effectiveTitle = logoAbs.isEmpty
        ? title
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.network(
                logoAbs,
                width: 26,
                height: 26,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
              const SizedBox(width: 10),
              Flexible(child: title),
            ],
          );

    return AppBar(
      title: effectiveTitle,
      actions: actions,
      leading: leading,
      centerTitle: centerTitle,
    );
  }
}
