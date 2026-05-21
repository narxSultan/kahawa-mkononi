import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/auth_controller.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/branded_background.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _username = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;

  Future<void> _showResultDialog({required String title, required String message, required bool success}) async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Icon(success ? Icons.check_circle : Icons.error, color: success ? const Color(0xFF2E7D32) : const Color(0xFFC62828)),
            const SizedBox(width: 10),
            Expanded(child: Text(title)),
          ],
        ),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _email.dispose();
    _username.dispose();
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final loading = auth.status == AuthStatus.unknown || auth.busy;

    return Scaffold(
      appBar: const BrandedAppBar(title: Text('Create account')),
      body: SafeArea(
        child: BrandedBackground(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 460),
                child: Card(
                  elevation: 3,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('Create account', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
                          const SizedBox(height: 6),
                          const Text('It takes less than a minute', style: TextStyle(color: Colors.black54)),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
                            validator: (v) {
                              final s = (v ?? '').trim();
                              if (s.isEmpty) return 'Email is required';
                              if (!s.contains('@')) return 'Enter a valid email';
                              return null;
                            },
                          ),
                          const SizedBox(height: 10),
                          TextFormField(
                            controller: _username,
                            decoration: const InputDecoration(labelText: 'Username', prefixIcon: Icon(Icons.person_outline)),
                            validator: (v) => (v ?? '').trim().isEmpty ? 'Username is required' : null,
                          ),
                          const SizedBox(height: 10),
                          TextFormField(
                            controller: _phone,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(labelText: 'Phone', prefixIcon: Icon(Icons.phone_outlined)),
                            validator: (v) => (v ?? '').trim().isEmpty ? 'Phone is required' : null,
                          ),
                          const SizedBox(height: 10),
                          TextFormField(
                            controller: _password,
                            obscureText: _obscure,
                            decoration: InputDecoration(
                              labelText: 'Password',
                              prefixIcon: const Icon(Icons.lock_outline),
                              helperText: 'Min 6 characters',
                              suffixIcon: IconButton(
                                onPressed: () => setState(() => _obscure = !_obscure),
                                icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                              ),
                            ),
                            validator: (v) {
                              final s = (v ?? '');
                              if (s.isEmpty) return 'Password is required';
                              if (s.length < 6) return 'Password too short';
                              return null;
                            },
                          ),
                          const SizedBox(height: 14),
                          if (auth.error != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Text(auth.error!, style: const TextStyle(color: Color(0xFFC62828), fontWeight: FontWeight.w700)),
                            ),
                          ElevatedButton.icon(
                            onPressed: loading
                                ? null
                                : () async {
                                    if (!(_formKey.currentState?.validate() ?? false)) return;
                                    if (!mounted) return;
                                    final err = await ref.read(authControllerProvider.notifier).register(
                                          email: _email.text,
                                          username: _username.text,
                                          phone: _phone.text,
                                          password: _password.text,
                                        );
                                    if (!mounted) return;
                                    if (err != null && err.trim().isNotEmpty) {
                                      await _showResultDialog(
                                        title: 'Registration failed',
                                        message: err,
                                        success: false,
                                      );
                                    }
                                  },
                            icon: const Icon(Icons.person_add_alt_1_outlined),
                            label: Text(loading ? 'Creating...' : 'Create account'),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Text('Already have an account?'),
                              const SizedBox(width: 6),
                              TextButton(onPressed: loading ? null : () => context.go('/login'), child: const Text('Login')),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
