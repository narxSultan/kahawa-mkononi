import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

import '../../providers/auth_controller.dart';
import '../../providers/dependencies.dart';
import '../../utils/app_config.dart';
import '../../widgets/branded_app_bar.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _edit = false;
  bool _saving = false;
  bool _uploadingPhoto = false;

  late final TextEditingController _name = TextEditingController();
  late final TextEditingController _phone = TextEditingController();
  late final TextEditingController _address = TextEditingController();
  late final TextEditingController _type = TextEditingController();
  late final TextEditingController _notes = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _type.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _fill() {
    final c = ref.read(authControllerProvider).customer;
    final u = ref.read(authControllerProvider).user;
    final isCustomer = (u?.roleName ?? '') == 'CUSTOMER';
    _name.text = isCustomer ? (c?.fullName ?? '') : (u?.fullName ?? '');
    _phone.text = isCustomer ? (c?.phone ?? '') : (u?.phone ?? '');
    _address.text = isCustomer ? (c?.address ?? '') : (u?.address ?? '');
    _type.text = c?.customerType ?? '';
    _notes.text = c?.notes ?? '';
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final c = auth.customer;
    final u = auth.user;
    final isCustomer = (u?.roleName ?? '') == 'CUSTOMER';

    if (!_edit) {
      // keep controllers fresh when not editing
      _fill();
    }

    return Scaffold(
      appBar: BrandedAppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            onPressed: _saving
                ? null
                : () {
                    setState(() => _edit = !_edit);
                  },
            icon: Icon(_edit ? Icons.close : Icons.edit_outlined),
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
                    Column(
                      children: [
                        Center(
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              CircleAvatar(
                                radius: 44,
                                backgroundColor: const Color(0xFFF3F4F6),
                                backgroundImage: (auth.user?.profilePhoto ?? '').trim().isEmpty
                                    ? null
                                    : NetworkImage(AppConfig.absUrl(auth.user?.profilePhoto)) as ImageProvider,
                                child: (auth.user?.profilePhoto ?? '').trim().isEmpty
                                    ? const Icon(Icons.person, size: 38, color: Colors.black54)
                                    : null,
                              ),
                              Positioned(
                                right: -2,
                                bottom: -2,
                                child: IconButton.filledTonal(
                                  onPressed: _uploadingPhoto
                                      ? null
                                      : () async {
                                          final picker = ImagePicker();
                                          final file = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1200, imageQuality: 85);
                                          if (file == null) return;
                                          final name = file.name.isEmpty ? 'profile.jpg' : file.name;
                                          final lower = name.toLowerCase();
                                          final contentType = lower.endsWith('.png')
                                              ? MediaType('image', 'png')
                                              : lower.endsWith('.webp')
                                                  ? MediaType('image', 'webp')
                                                  : lower.endsWith('.gif')
                                                      ? MediaType('image', 'gif')
                                                      : MediaType('image', 'jpeg');
                                          setState(() => _uploadingPhoto = true);
                                          try {
                                            final bytes = await file.readAsBytes();
                                            final url =
                                                await ref.read(uploadRepositoryProvider).uploadProfilePhoto(bytes: bytes, filename: name, contentType: contentType);
                                            await ref.read(authControllerProvider.notifier).updateProfilePhoto(url);
                                            if (!context.mounted) return;
                                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile photo updated')));
                                          } catch (e) {
                                            if (!context.mounted) return;
                                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
                                          } finally {
                                            if (mounted) setState(() => _uploadingPhoto = false);
                                          }
                                        },
                                  iconSize: 16,
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints.tightFor(width: 34, height: 34),
                                  visualDensity: VisualDensity.compact,
                                  icon: _uploadingPhoto
                                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                                      : const Icon(Icons.camera_alt_outlined),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          isCustomer ? (c?.fullName ?? u?.fullName ?? 'Customer') : (u?.fullName ?? 'User'),
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 6),
                        Text(u?.email ?? '', textAlign: TextAlign.center, style: const TextStyle(color: Colors.black54)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    if (_edit) ...[
                      TextField(controller: _name, decoration: const InputDecoration(labelText: 'Full name', prefixIcon: Icon(Icons.person_outline))),
                      const SizedBox(height: 10),
                      TextField(controller: _phone, decoration: const InputDecoration(labelText: 'Phone', prefixIcon: Icon(Icons.phone_outlined))),
                      const SizedBox(height: 10),
                      TextField(controller: _address, decoration: const InputDecoration(labelText: 'Address', prefixIcon: Icon(Icons.location_on_outlined))),
                      if (isCustomer) ...[
                        const SizedBox(height: 10),
                        TextField(controller: _type, decoration: const InputDecoration(labelText: 'Customer type (optional)', prefixIcon: Icon(Icons.badge_outlined))),
                        const SizedBox(height: 10),
                        TextField(controller: _notes, maxLines: 3, decoration: const InputDecoration(labelText: 'Notes (optional)', prefixIcon: Icon(Icons.note_outlined))),
                      ],
                      const SizedBox(height: 12),
                      ElevatedButton.icon(
                        onPressed: _saving
                            ? null
                            : () async {
                                setState(() => _saving = true);
                                try {
                                  if (isCustomer) {
                                    await ref.read(authControllerProvider.notifier).updateProfile(
                                          fullName: _name.text.trim(),
                                          phone: _phone.text.trim(),
                                          address: _address.text.trim(),
                                          customerType: _type.text.trim().isEmpty ? null : _type.text.trim(),
                                          notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
                                        );
                                  } else {
                                    await ref.read(authControllerProvider.notifier).updateAccountInfo(
                                          fullName: _name.text.trim(),
                                          phone: _phone.text.trim(),
                                          address: _address.text.trim(),
                                        );
                                  }
                                  if (mounted) setState(() => _edit = false);
                                } finally {
                                  if (mounted) setState(() => _saving = false);
                                }
                              },
                        icon: const Icon(Icons.save_outlined),
                        label: Text(_saving ? 'Saving...' : 'Save'),
                      ),
                    ] else ...[
                      _InfoRow(icon: Icons.phone_outlined, label: 'Phone', value: isCustomer ? (c?.phone ?? '—') : ((u?.phone ?? '').trim().isEmpty ? '—' : u!.phone!)),
                      _InfoRow(icon: Icons.location_on_outlined, label: 'Address', value: isCustomer ? ((c?.address ?? '').trim().isEmpty ? '—' : c!.address!) : ((u?.address ?? '').trim().isEmpty ? '—' : u!.address!)),
                      if (isCustomer)
                        _InfoRow(icon: Icons.badge_outlined, label: 'Type', value: (c?.customerType ?? '').isEmpty ? '—' : c!.customerType!)
                      else ...[
                        _InfoRow(icon: Icons.verified_user_outlined, label: 'Role', value: u?.roleName ?? '—'),
                        if ((u?.serviceCentreName ?? '').trim().isNotEmpty) _InfoRow(icon: Icons.store_outlined, label: 'Service centre', value: u!.serviceCentreName!),
                      ],
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Column(
                children: [
                  if (isCustomer) ...[
                    ListTile(
                      leading: const Icon(Icons.star_outline),
                      title: const Text('My feedback'),
                      subtitle: const Text('View and submit ratings'),
                      onTap: () => context.push('/profile/feedback'),
                    ),
                    const Divider(height: 0),
                  ],
                  ListTile(
                    leading: const Icon(Icons.logout),
                    title: const Text('Logout'),
                    onTap: () async {
                      final ok = await showDialog<bool>(
                        context: context,
                        builder: (c) => AlertDialog(
                          title: const Text('Logout?'),
                          content: const Text('You will need to sign in again.'),
                          actions: [
                            TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Cancel')),
                            ElevatedButton(onPressed: () => Navigator.of(c).pop(true), child: const Text('Logout')),
                          ],
                        ),
                      );
                      if (ok == true) await ref.read(authControllerProvider.notifier).logout();
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54)),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
              ],
            ),
          )
        ],
      ),
    );
  }
}
