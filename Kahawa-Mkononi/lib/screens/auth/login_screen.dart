import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/auth_controller.dart';
import '../../providers/branding_provider.dart';
import '../../utils/app_config.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/branded_background.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  Timer? _errorClearTimer;
  bool _obscure = true;

  @override
  void dispose() {
    _errorClearTimer?.cancel();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final loading = auth.status == AuthStatus.unknown || auth.busy;
    final logoAbs = AppConfig.absUrl(ref.watch(appLogoUrlProvider).valueOrNull);

    return Scaffold(
      appBar: const BrandedAppBar(title: Text('KAHAWA MKONONI')),
      body: SafeArea(
        child: BrandedBackground(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
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
                          Center(
                            child: Container(
                              width: 96,
                              height: 96,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.white,
                                border: Border.all(color: const Color(0xFFE5E7EB)),
                                boxShadow: const [
                                  BoxShadow(color: Color(0x14000000), blurRadius: 18, offset: Offset(0, 10)),
                                ],
                              ),
                              child: ClipOval(
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: logoAbs.isEmpty
                                      ? const Center(child: Icon(Icons.local_cafe_outlined, color: Colors.black54, size: 40))
                                      : Image.network(
                                          logoAbs,
                                          fit: BoxFit.contain,
                                          errorBuilder: (_, __, ___) => const Center(
                                            child: Icon(Icons.local_cafe_outlined, color: Colors.black54, size: 40),
                                          ),
                                        ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text('Welcome back', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
                          const SizedBox(height: 6),
                          const Text('Sign in to continue', style: TextStyle(color: Colors.black54)),
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
                            controller: _password,
                            obscureText: _obscure,
                            decoration: InputDecoration(
                              labelText: 'Password',
                              prefixIcon: const Icon(Icons.lock_outline),
                              suffixIcon: IconButton(
                                onPressed: () => setState(() => _obscure = !_obscure),
                                icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                              ),
                            ),
                            validator: (v) => (v ?? '').isEmpty ? 'Password is required' : null,
                          ),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: loading ? null : () => context.go('/forgot'),
                              child: const Text('Forgot password?'),
                            ),
                          ),
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
                                    final err = await ref.read(authControllerProvider.notifier).login(
                                          email: _email.text,
                                          password: _password.text,
                                        );
                                    if (!mounted) return;
                                    if (err != null && err.trim().isNotEmpty) {
                                      _errorClearTimer?.cancel();
                                      _errorClearTimer = Timer(const Duration(seconds: 3), () {
                                        ref.read(authControllerProvider.notifier).clearError();
                                      });
                                    }
                                  },
                            icon: const Icon(Icons.login),
                            label: Text(loading ? 'Signing in...' : 'Login'),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Text("Don't have an account?"),
                              const SizedBox(width: 6),
                              TextButton(
                                onPressed: loading ? null : () => context.go('/register'),
                                child: const Text('Create one'),
                              ),
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
