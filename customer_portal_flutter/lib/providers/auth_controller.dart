import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/customer.dart';
import '../models/user.dart';
import '../services/api/api_exception.dart';
import 'dependencies.dart';

enum AuthStatus { unknown, unauthenticated, authenticated }

enum AuthEvent { loginSuccess, registerSuccess }

class AuthState {
  final AuthStatus status;
  final User? user;
  final Customer? customer;
  final String? error;
  final AuthEvent? event;
  final bool busy;

  const AuthState({required this.status, this.user, this.customer, this.error, this.event, this.busy = false});

  const AuthState.unknown() : this(status: AuthStatus.unknown);
  const AuthState.unauthenticated([String? error]) : this(status: AuthStatus.unauthenticated, error: error);
  const AuthState.authenticated({required User user, Customer? customer, AuthEvent? event})
      : this(status: AuthStatus.authenticated, user: user, customer: customer, event: event);
}

class AuthController extends StateNotifier<AuthState> {
  final Ref ref;
  AuthController(this.ref) : super(const AuthState.unknown());

  Future<void> init() async {
    final repo = ref.read(authRepositoryProvider);
    await repo.loadTokensFromStorage();
    final me = await _safeMe();
    if (me == null) {
      state = const AuthState.unauthenticated();
      return;
    }
    final profile = me.roleName == 'CUSTOMER' ? await _safeProfile() : null;
    state = AuthState.authenticated(user: me, customer: profile);
  }

  Future<User?> _safeMe() async {
    try {
      return await ref.read(authRepositoryProvider).me();
    } on ApiException {
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<Customer?> _safeProfile() async {
    try {
      return await ref.read(authRepositoryProvider).myCustomerProfile();
    } on ApiException {
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<String?> login({required String email, required String password}) async {
    try {
      state = const AuthState(status: AuthStatus.unauthenticated, busy: true);
      await ref.read(authRepositoryProvider).login(email: email, password: password);
      final me = await ref.read(authRepositoryProvider).me();
      if (me == null) {
        state = const AuthState.unauthenticated('Failed to sign in.');
        return state.error ?? 'Failed to sign in.';
      }
      final profile = me.roleName == 'CUSTOMER' ? await ref.read(authRepositoryProvider).myCustomerProfile() : null;
      state = AuthState.authenticated(user: me, customer: profile, event: AuthEvent.loginSuccess);
      return null;
    } on ApiException catch (e) {
      state = AuthState.unauthenticated(e.message);
      return state.error ?? e.message;
    } catch (e) {
      state = AuthState.unauthenticated(e.toString());
      return state.error ?? e.toString();
    }
  }

  Future<String?> register({
    required String email,
    required String username,
    required String phone,
    required String password,
  }) async {
    try {
      state = const AuthState(status: AuthStatus.unauthenticated, busy: true);
      await ref.read(authRepositoryProvider).registerCustomer(email: email, username: username, phone: phone, password: password);
      final me = await ref.read(authRepositoryProvider).me();
      if (me == null) {
        state = const AuthState.unauthenticated('Failed to register.');
        return state.error ?? 'Failed to register.';
      }
      final profile = await ref.read(authRepositoryProvider).myCustomerProfile();
      state = AuthState.authenticated(user: me, customer: profile, event: AuthEvent.registerSuccess);
      return null;
    } on ApiException catch (e) {
      state = AuthState.unauthenticated(e.message);
      return state.error ?? e.message;
    } catch (e) {
      state = AuthState.unauthenticated(e.toString());
      return state.error ?? e.toString();
    }
  }

  void clearEvent() {
    if (state.event == null) return;
    if (state.status == AuthStatus.authenticated && state.user != null) {
      state = AuthState.authenticated(user: state.user!, customer: state.customer);
      return;
    }
    state = AuthState(status: state.status, user: state.user, customer: state.customer, error: state.error, busy: false);
  }

  Future<void> refreshProfile() async {
    if (state.status != AuthStatus.authenticated) return;
    if ((state.user?.roleName ?? '') != 'CUSTOMER') return;
    final profile = await ref.read(authRepositoryProvider).myCustomerProfile();
    state = AuthState.authenticated(user: state.user!, customer: profile);
  }

  Future<void> refreshMe() async {
    if (state.status != AuthStatus.authenticated) return;
    final me = await ref.read(authRepositoryProvider).me();
    if (me == null) return;
    state = AuthState.authenticated(user: me, customer: state.customer);
  }

  Future<void> updateProfile({
    String? fullName,
    String? phone,
    String? address,
    String? customerType,
    String? notes,
  }) async {
    if (state.status != AuthStatus.authenticated) return;
    if ((state.user?.roleName ?? '') != 'CUSTOMER') return;
    await ref.read(authRepositoryProvider).updateMyProfile(
          fullName: fullName,
          phone: phone,
          address: address,
          customerType: customerType,
          notes: notes,
        );
    await Future.wait([refreshProfile(), refreshMe()]);
  }

  Future<void> updateProfilePhoto(String profilePhotoUrl) async {
    if (state.status != AuthStatus.authenticated) return;
    final me = await ref.read(authRepositoryProvider).updateMyAccount(profilePhoto: profilePhotoUrl);
    state = AuthState.authenticated(user: me, customer: state.customer);
  }

  Future<void> updateAccountInfo({
    String? fullName,
    String? phone,
    String? address,
  }) async {
    if (state.status != AuthStatus.authenticated) return;
    final me = await ref.read(authRepositoryProvider).updateMyAccount(
          fullName: fullName,
          phone: phone,
          address: address,
        );
    state = AuthState.authenticated(user: me, customer: state.customer);
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState.unauthenticated();
  }
}

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(ref);
});
