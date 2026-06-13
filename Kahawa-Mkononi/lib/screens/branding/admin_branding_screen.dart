import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

import '../../providers/auth_controller.dart';
import '../../providers/branding_provider.dart';
import '../../providers/dependencies.dart';
import '../../utils/app_config.dart';
import '../../widgets/branded_app_bar.dart';

class AdminBrandingScreen extends ConsumerStatefulWidget {
  const AdminBrandingScreen({super.key});

  @override
  ConsumerState<AdminBrandingScreen> createState() => _AdminBrandingScreenState();
}

class _AdminBrandingScreenState extends ConsumerState<AdminBrandingScreen> {
  bool _busy = false;
  String? _error;
  XFile? _selected;
  Uint8List? _selectedBytes;

  MediaType _contentTypeFromName(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.png')) return MediaType('image', 'png');
    if (lower.endsWith('.webp')) return MediaType('image', 'webp');
    if (lower.endsWith('.gif')) return MediaType('image', 'gif');
    return MediaType('image', 'jpeg');
  }

  Future<void> _pick() async {
    setState(() => _error = null);
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 90);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    setState(() {
      _selected = file;
      _selectedBytes = bytes;
    });
  }

  Future<void> _upload() async {
    if (_selected == null || _selectedBytes == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final name = _selected!.name.isEmpty ? 'logo.png' : _selected!.name;
      final url = await ref.read(uploadRepositoryProvider).uploadSystemLogo(
            bytes: _selectedBytes!,
            filename: name,
            contentType: _contentTypeFromName(name),
          );
      await ref.read(brandingRepositoryProvider).setAppLogoUrl(url);
      ref.invalidate(appLogoUrlProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Logo saved')));
      setState(() {
        _selected = null;
        _selectedBytes = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final logo = ref.watch(appLogoUrlProvider).valueOrNull;
    final logoAbs = AppConfig.absUrl(logo);

    return Scaffold(
      appBar: BrandedAppBar(
        title: const Text('Branding'),
        actions: [
          IconButton(
            tooltip: 'Logout',
            onPressed: _busy ? null : () => ref.read(authControllerProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
          )
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Current logo', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 8),
                    if (logoAbs.isEmpty)
                      const Text('No logo set', style: TextStyle(color: Colors.black54))
                    else
                      Container(
                        height: 180,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF7F3EE),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            Opacity(opacity: 0.06, child: Center(child: Image.network(logoAbs, fit: BoxFit.contain))),
                            Center(child: Image.network(logoAbs, width: 96, height: 96)),
                          ],
                        ),
                      ),
                    const SizedBox(height: 10),
                    Text(
                      'Signed in as: ${auth.user?.fullName ?? ''} (${auth.user?.roleName ?? ''})',
                      style: const TextStyle(color: Colors.black54),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Logo specification', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 8),
                    const Text('• Formats: JPEG, PNG, WEBP, GIF', style: TextStyle(color: Colors.black87)),
                    const Text('• Max size: 3 MB', style: TextStyle(color: Colors.black87)),
                    const Text('• Recommended: 512×512 (square), transparent background (PNG/WebP)', style: TextStyle(color: Colors.black87)),
                    const Text('• Tip: Use a high-contrast logo for visibility', style: TextStyle(color: Colors.black87)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Upload new logo', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _busy ? null : _pick,
                            icon: const Icon(Icons.image_outlined),
                            label: Text(_selected == null ? 'Choose image' : 'Change image'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _busy || _selected == null ? null : _upload,
                            icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.cloud_upload_outlined),
                            label: const Text('Upload & save'),
                          ),
                        ),
                      ],
                    ),
                    if (_selected != null && _selectedBytes != null) ...[
                      const SizedBox(height: 12),
                      Text(_selected!.name, style: const TextStyle(color: Colors.black54)),
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          height: 140,
                          color: const Color(0xFFF7F3EE),
                          alignment: Alignment.center,
                          child: Image.memory(_selectedBytes!, fit: BoxFit.contain),
                        ),
                      ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: const TextStyle(color: Color(0xFFC62828), fontWeight: FontWeight.w800)),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
