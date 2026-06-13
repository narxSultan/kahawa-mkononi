import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'providers/branding_provider.dart';
import 'providers/dependencies.dart';
import 'router/app_router.dart';
import 'services/api/app_version_repository.dart';
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
    final version = ref.watch(appVersionProvider);
    return MaterialApp.router(
      title: 'KAHAWA MKONONI',
      theme: AppTheme.light(),
      routerConfig: router,
      builder: (context, child) {
        final c = child ?? const SizedBox.shrink();
        final app = logoAbs.isEmpty
            ? c
            : Stack(
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
        final info = version.valueOrNull;
        if (info == null || !info.mustUpdate) return app;
        return Stack(
          fit: StackFit.expand,
          children: [
            app,
            _ForcedUpdateOverlay(info: info),
          ],
        );
      },
    );
  }
}

class _ForcedUpdateOverlay extends ConsumerWidget {
  final AppVersionInfo info;

  const _ForcedUpdateOverlay({required this.info});

  Future<void> _download() async {
    final uri = Uri.tryParse(info.downloadUrl);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Material(
      color: Colors.black54,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Card(
            margin: const EdgeInsets.all(20),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.system_update_alt, size: 42, color: Color(0xFF6F4E37)),
                  const SizedBox(height: 12),
                  Text(
                    'Update required',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'A newer KAHAWA MKONONI app is available. You must download version ${info.latestVersion} to continue.',
                    textAlign: TextAlign.center,
                  ),
                  if ((info.releaseNotes ?? '').trim().isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      info.releaseNotes!.trim(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.black54),
                    ),
                  ],
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _download,
                    icon: const Icon(Icons.download),
                    label: const Text('Download update'),
                  ),
                  TextButton(
                    onPressed: () => ref.invalidate(appVersionProvider),
                    child: const Text('I have updated, check again'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
