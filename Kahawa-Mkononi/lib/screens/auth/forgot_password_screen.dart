import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/dependencies.dart';
import '../../widgets/branded_app_bar.dart';
import '../../widgets/branded_background.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  final _p1 = TextEditingController();
  final _p2 = TextEditingController();
  bool _stepReset = false;
  bool _busy = false;
  bool _ob1 = true;
  bool _ob2 = true;
  String? _err;

  @override
  void dispose() {
    _email.dispose();
    _p1.dispose();
    _p2.dispose();
    super.dispose();
  }

  Future<void> _checkEmail() async {
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final ok = await ref.read(authRepositoryProvider).requestCustomerPasswordReset(email: _email.text);
      if (!mounted) return;
      if (!ok) {
        setState(() => _err = 'Email not found.');
        return;
      }
      setState(() => _stepReset = true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _err = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reset() async {
    final p1 = _p1.text;
    final p2 = _p2.text;
    if (p1.length < 6) {
      setState(() => _err = 'Password too short (min 6).');
      return;
    }
    if (p1 != p2) {
      setState(() => _err = 'Passwords do not match.');
      return;
    }
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final ok = await ref.read(authRepositoryProvider).resetCustomerPassword(email: _email.text, newPassword: p1);
      if (!mounted) return;
      if (!ok) {
        setState(() => _err = 'Failed to reset password.');
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password updated. Please login.')));
      context.go('/login');
    } catch (e) {
      if (!mounted) return;
      setState(() => _err = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const BrandedAppBar(title: Text('Forgot password')),
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(_stepReset ? 'Set a new password' : 'Find your account',
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
                        const SizedBox(height: 6),
                        Text(
                          _stepReset ? 'Enter your new password below.' : 'Enter your email to continue.',
                          style: const TextStyle(color: Colors.black54),
                        ),
                        const SizedBox(height: 16),
                        TextField(
                          controller: _email,
                          enabled: !_busy && !_stepReset,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
                        ),
                        if (_stepReset) ...[
                          const SizedBox(height: 10),
                          TextField(
                            controller: _p1,
                            enabled: !_busy,
                            obscureText: _ob1,
                            decoration: InputDecoration(
                              labelText: 'New password',
                              prefixIcon: const Icon(Icons.lock_reset_outlined),
                              helperText: 'Min 6 characters',
                              suffixIcon: IconButton(
                                onPressed: _busy ? null : () => setState(() => _ob1 = !_ob1),
                                icon: Icon(_ob1 ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: _p2,
                            enabled: !_busy,
                            obscureText: _ob2,
                            decoration: InputDecoration(
                              labelText: 'Confirm password',
                              prefixIcon: const Icon(Icons.lock_outline),
                              suffixIcon: IconButton(
                                onPressed: _busy ? null : () => setState(() => _ob2 = !_ob2),
                                icon: Icon(_ob2 ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                              ),
                            ),
                          ),
                        ],
                        if (_err != null) ...[
                          const SizedBox(height: 12),
                          Text(_err!, style: const TextStyle(color: Color(0xFFC62828), fontWeight: FontWeight.w800)),
                        ],
                        const SizedBox(height: 14),
                        ElevatedButton.icon(
                          onPressed: _busy
                              ? null
                              : () {
                                  if (_stepReset) {
                                    _reset();
                                  } else {
                                    _checkEmail();
                                  }
                                },
                          icon: _busy
                              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                              : Icon(_stepReset ? Icons.check_circle_outline : Icons.search),
                          label: Text(_busy ? 'Please wait...' : (_stepReset ? 'Update password' : 'Continue')),
                        ),
                        const SizedBox(height: 10),
                        TextButton(
                          onPressed: _busy ? null : () => context.go('/login'),
                          child: const Text('Back to login'),
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
    );
  }
}

