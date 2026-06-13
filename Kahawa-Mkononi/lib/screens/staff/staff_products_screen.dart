import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

import '../../models/product.dart';
import '../../providers/dependencies.dart';
import '../../providers/auth_controller.dart';
import '../../providers/staff_products_provider.dart';
import '../../utils/app_config.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/empty_view.dart';
import '../../widgets/error_view.dart';
import '../../widgets/loading_view.dart';

enum _ProductAction { edit, delete, activate }

class StaffProductsScreen extends ConsumerStatefulWidget {
  const StaffProductsScreen({super.key});

  @override
  ConsumerState<StaffProductsScreen> createState() => _StaffProductsScreenState();
}

class _StaffProductsScreenState extends ConsumerState<StaffProductsScreen> {
  bool _creating = false;
  bool _showInactive = false;

  Future<void> _openCreate() async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _creating = true);
    final created = await showModalBottomSheet<Product>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _CreateProductSheet(),
    );
    if (mounted) setState(() => _creating = false);
    if (created == null) return;
    await ref.read(staffProductsProvider.notifier).reload();
    if (!mounted) return;
    messenger.showSnackBar(SnackBar(content: Text('Product created: ${created.name}')));
  }

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(staffProductsProvider);

    return Scaffold(
      appBar: BrandedAppBar(
        title: const Text('Products'),
        actions: [
          IconButton(
            tooltip: 'Logout',
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
          ),
          IconButton(
            tooltip: _showInactive ? 'Hide inactive' : 'Show inactive',
            onPressed: () {
              setState(() => _showInactive = !_showInactive);
              ref.read(staffProductsProvider.notifier).setShowInactive(_showInactive);
            },
            icon: Icon(_showInactive ? Icons.visibility_off_outlined : Icons.visibility_outlined),
          ),
          IconButton(
            tooltip: 'Add product',
            onPressed: _creating ? null : _openCreate,
            icon: const Icon(Icons.add_circle_outline),
          ),
        ],
      ),
      body: SafeArea(
        child: products.when(
          loading: () => const LoadingView(),
          error: (e, _) => ErrorView(
            title: 'Failed to load products',
            details: e.toString(),
            onRetry: () => ref.read(staffProductsProvider.notifier).reload(),
          ),
          data: (list) {
            if (list.isEmpty) return const EmptyView(title: 'No products', subtitle: 'Create your first product.');
            return RefreshIndicator(
              onRefresh: () => ref.read(staffProductsProvider.notifier).reload(),
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final p = list[i];
                  return Card(
                    child: ListTile(
                      leading: _Thumb(imageUrl: p.imageUrl),
                      title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w900)),
                      subtitle: Text('${p.price} ${p.currency}${p.isActive ? '' : ' • inactive'}'),
                      trailing: PopupMenuButton<_ProductAction>(
                        tooltip: 'Actions',
                        onSelected: (a) => _handleAction(p, a),
                        itemBuilder: (_) => [
                          const PopupMenuItem(value: _ProductAction.edit, child: Text('Edit')),
                          if (p.isActive)
                            const PopupMenuItem(value: _ProductAction.delete, child: Text('Delete'))
                          else
                            const PopupMenuItem(value: _ProductAction.activate, child: Text('Activate')),
                        ],
                      ),
                    ),
                  );
                },
              ),
            );
          },
        ),
      ),
    );
  }

  Future<void> _handleAction(Product p, _ProductAction action) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      switch (action) {
        case _ProductAction.edit:
          final updated = await showModalBottomSheet<Product>(
            context: context,
            isScrollControlled: true,
            showDragHandle: true,
            builder: (_) => _EditProductSheet(product: p),
          );
          if (updated == null) return;
          await ref.read(staffProductsProvider.notifier).reload();
          if (!mounted) return;
          messenger.showSnackBar(SnackBar(content: Text('Product updated: ${updated.name}')));
          return;
        case _ProductAction.delete:
          final ok = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Delete product?'),
              content: Text('Delete "${p.name}"? It will be hidden from customers.'),
              actions: [
                TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
                ElevatedButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Delete')),
              ],
            ),
          );
          if (ok != true) return;
          await ref.read(productAdminRepositoryProvider).deactivate(id: p.id);
          await ref.read(staffProductsProvider.notifier).reload();
          if (!mounted) return;
          messenger.showSnackBar(const SnackBar(content: Text('Product deleted')));
          return;
        case _ProductAction.activate:
          await ref.read(productAdminRepositoryProvider).setActive(id: p.id, active: true);
          await ref.read(staffProductsProvider.notifier).reload();
          if (!mounted) return;
          messenger.showSnackBar(const SnackBar(content: Text('Product activated')));
          return;
      }
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }
}

class _CreateProductSheet extends ConsumerStatefulWidget {
  const _CreateProductSheet();

  @override
  ConsumerState<_CreateProductSheet> createState() => _CreateProductSheetState();
}

class _CreateProductSheetState extends ConsumerState<_CreateProductSheet> {
  final _name = TextEditingController();
  final _desc = TextEditingController();
  final _price = TextEditingController(text: '0');
  final _currency = TextEditingController(text: 'TZS');
  bool _busy = false;
  String? _err;
  XFile? _file;
  Uint8List? _bytes;

  @override
  void dispose() {
    _name.dispose();
    _desc.dispose();
    _price.dispose();
    _currency.dispose();
    super.dispose();
  }

  MediaType _contentTypeFromName(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.png')) return MediaType('image', 'png');
    if (lower.endsWith('.webp')) return MediaType('image', 'webp');
    if (lower.endsWith('.gif')) return MediaType('image', 'gif');
    return MediaType('image', 'jpeg');
  }

  Future<void> _pick() async {
    final picker = ImagePicker();
    final f = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 90);
    if (f == null) return;
    final b = await f.readAsBytes();
    setState(() {
      _file = f;
      _bytes = b;
    });
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) return setState(() => _err = 'Name is required.');
    if (_price.text.trim().isEmpty) return setState(() => _err = 'Price is required.');

    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      String? imageUrl;
      if (_file != null && _bytes != null) {
        imageUrl = await ref.read(uploadRepositoryProvider).uploadProductImage(
              bytes: _bytes!,
              filename: _file!.name.isEmpty ? 'product.jpg' : _file!.name,
              contentType: _contentTypeFromName(_file!.name),
            );
      }

      final created = await ref.read(productAdminRepositoryProvider).create(
            name: name,
            description: _desc.text.trim().isEmpty ? null : _desc.text.trim(),
            price: _price.text.trim(),
            currency: _currency.text.trim().isEmpty ? 'TZS' : _currency.text.trim(),
            imageUrl: imageUrl,
          );
      if (!mounted) return;
      Navigator.of(context).pop(created);
    } catch (e) {
      if (!mounted) return;
      setState(() => _err = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        shrinkWrap: true,
        children: [
          Text('Create product', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name', prefixIcon: Icon(Icons.local_cafe_outlined))),
          const SizedBox(height: 10),
          TextField(controller: _desc, maxLines: 3, decoration: const InputDecoration(labelText: 'Description (optional)', prefixIcon: Icon(Icons.notes_outlined))),
          const SizedBox(height: 10),
          TextField(controller: _price, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Price', prefixIcon: Icon(Icons.payments_outlined))),
          const SizedBox(height: 10),
          TextField(controller: _currency, decoration: const InputDecoration(labelText: 'Currency', prefixIcon: Icon(Icons.currency_exchange))),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _busy ? null : _pick,
            icon: const Icon(Icons.image_outlined),
            label: Text(_file == null ? 'Add image (optional)' : 'Change image'),
          ),
          if (_bytes != null) ...[
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Container(
                height: 160,
                color: const Color(0xFFF7F3EE),
                alignment: Alignment.center,
                child: Image.memory(_bytes!, fit: BoxFit.contain),
              ),
            ),
          ],
          if (_err != null) ...[
            const SizedBox(height: 10),
            Text(_err!, style: const TextStyle(color: Color(0xFFC62828), fontWeight: FontWeight.w800)),
          ],
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: _busy ? null : _save,
            icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.check_circle_outline),
            label: Text(_busy ? 'Saving...' : 'Create'),
          ),
          const SizedBox(height: 6),
          TextButton(onPressed: _busy ? null : () => Navigator.of(context).pop(), child: const Text('Cancel')),
        ],
      ),
    );
  }
}

class _EditProductSheet extends ConsumerStatefulWidget {
  final Product product;
  const _EditProductSheet({required this.product});

  @override
  ConsumerState<_EditProductSheet> createState() => _EditProductSheetState();
}

class _EditProductSheetState extends ConsumerState<_EditProductSheet> {
  late final TextEditingController _name;
  late final TextEditingController _desc;
  late final TextEditingController _price;
  late final TextEditingController _currency;
  bool _busy = false;
  String? _err;
  XFile? _file;
  Uint8List? _bytes;
  bool _removeImage = false;
  bool _isActive = true;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.product.name);
    _desc = TextEditingController(text: widget.product.description ?? '');
    _price = TextEditingController(text: widget.product.price);
    _currency = TextEditingController(text: widget.product.currency);
    _isActive = widget.product.isActive;
  }

  @override
  void dispose() {
    _name.dispose();
    _desc.dispose();
    _price.dispose();
    _currency.dispose();
    super.dispose();
  }

  MediaType _contentTypeFromName(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.png')) return MediaType('image', 'png');
    if (lower.endsWith('.webp')) return MediaType('image', 'webp');
    if (lower.endsWith('.gif')) return MediaType('image', 'gif');
    return MediaType('image', 'jpeg');
  }

  Future<void> _pick() async {
    final picker = ImagePicker();
    final f = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 90);
    if (f == null) return;
    final b = await f.readAsBytes();
    setState(() {
      _file = f;
      _bytes = b;
      _removeImage = false;
    });
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) return setState(() => _err = 'Name is required.');
    if (_price.text.trim().isEmpty) return setState(() => _err = 'Price is required.');

    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final trimmedDesc = _desc.text.trim();
      final clearDescription = trimmedDesc.isEmpty;

      String? newImageUrl;
      if (_file != null && _bytes != null) {
        newImageUrl = await ref.read(uploadRepositoryProvider).uploadProductImage(
              bytes: _bytes!,
              filename: _file!.name.isEmpty ? 'product.jpg' : _file!.name,
              contentType: _contentTypeFromName(_file!.name),
            );
      }

      final updated = await ref.read(productAdminRepositoryProvider).update(
            id: widget.product.id,
            name: name,
            description: clearDescription ? null : trimmedDesc,
            clearDescription: clearDescription,
            price: _price.text.trim(),
            currency: _currency.text.trim().isEmpty ? 'TZS' : _currency.text.trim(),
            isActive: _isActive,
            imageUrl: newImageUrl,
            clearImage: _removeImage,
          );
      if (!mounted) return;
      Navigator.of(context).pop(updated);
    } catch (e) {
      if (!mounted) return;
      setState(() => _err = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final existingUrl = widget.product.imageUrl;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        shrinkWrap: true,
        children: [
          Text('Edit product', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name', prefixIcon: Icon(Icons.local_cafe_outlined))),
          const SizedBox(height: 10),
          TextField(controller: _desc, maxLines: 3, decoration: const InputDecoration(labelText: 'Description (optional)', prefixIcon: Icon(Icons.notes_outlined))),
          const SizedBox(height: 10),
          TextField(controller: _price, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Price', prefixIcon: Icon(Icons.payments_outlined))),
          const SizedBox(height: 10),
          TextField(controller: _currency, decoration: const InputDecoration(labelText: 'Currency', prefixIcon: Icon(Icons.currency_exchange))),
          const SizedBox(height: 10),
          SwitchListTile(
            value: _isActive,
            onChanged: _busy ? null : (v) => setState(() => _isActive = v),
            title: const Text('Active'),
            subtitle: const Text('Inactive products are hidden from customers'),
          ),
          const SizedBox(height: 6),
          OutlinedButton.icon(
            onPressed: _busy ? null : _pick,
            icon: const Icon(Icons.image_outlined),
            label: Text(_file == null ? 'Change image' : 'Change image again'),
          ),
          if (existingUrl != null && existingUrl.trim().isNotEmpty && _file == null) ...[
            const SizedBox(height: 8),
            CheckboxListTile(
              value: _removeImage,
              onChanged: _busy ? null : (v) => setState(() => _removeImage = v ?? false),
              title: const Text('Remove current image'),
            ),
          ],
          if (_bytes != null) ...[
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Container(
                height: 160,
                color: const Color(0xFFF7F3EE),
                alignment: Alignment.center,
                child: Image.memory(_bytes!, fit: BoxFit.contain),
              ),
            ),
          ],
          if (_err != null) ...[
            const SizedBox(height: 10),
            Text(_err!, style: const TextStyle(color: Color(0xFFC62828), fontWeight: FontWeight.w800)),
          ],
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: _busy ? null : _save,
            icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.check_circle_outline),
            label: Text(_busy ? 'Saving...' : 'Save'),
          ),
          const SizedBox(height: 6),
          TextButton(onPressed: _busy ? null : () => Navigator.of(context).pop(), child: const Text('Cancel')),
        ],
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  final String? imageUrl;
  const _Thumb({required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    final abs = AppConfig.absUrl(imageUrl);
    if (abs.isEmpty) {
      return const CircleAvatar(
        backgroundColor: Color(0xFFF3F4F6),
        child: Icon(Icons.local_cafe_outlined, color: Colors.black54),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 46,
        height: 46,
        child: Image.network(
          abs,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            color: const Color(0xFFF3F4F6),
            alignment: Alignment.center,
            child: const Icon(Icons.broken_image_outlined, color: Colors.black54),
          ),
        ),
      ),
    );
  }
}
