import '../../models/auth_tokens.dart';
import '../../models/customer.dart';
import '../../models/user.dart';
import 'graphql_api.dart';
import 'token_storage.dart';
import 'auth_session.dart';

class AuthRepository {
  final GraphqlApi api;
  final TokenStorage tokenStorage;
  final AuthSession session;

  AuthRepository({required this.api, required this.tokenStorage, required this.session});

  Future<(User user, AuthTokens tokens)> login({required String email, required String password}) async {
    final data = await api.mutate(
      r'''
mutation Login($input: LoginInput!) {
  login(input: $input) {
    tokens { accessToken refreshToken }
    user { id email fullName phone username profilePhoto address status role { name } }
  }
}
''',
      variables: {
        'input': {'email': email.trim().toLowerCase(), 'password': password}
      },
    );
    final payload = data['login'] as Map<String, dynamic>;
    final tokens = AuthTokens.fromJson(payload['tokens'] as Map<String, dynamic>);
    final user = User.fromJson(payload['user'] as Map<String, dynamic>);
    session.setTokens(tokens);
    await tokenStorage.writeTokens(accessToken: tokens.accessToken, refreshToken: tokens.refreshToken);
    return (user, tokens);
  }

  Future<(User user, AuthTokens tokens)> registerCustomer({
    required String email,
    required String username,
    required String phone,
    required String password,
  }) async {
    final data = await api.mutate(
      r'''
mutation Register($input: RegisterCustomerInput!) {
  registerCustomer(input: $input) {
    tokens { accessToken refreshToken }
    user { id email fullName phone username profilePhoto address status role { name } }
  }
}
''',
      variables: {
        'input': {
          'email': email.trim().toLowerCase(),
          'username': username.trim(),
          'phone': phone.trim(),
          'password': password,
        }
      },
    );
    final payload = data['registerCustomer'] as Map<String, dynamic>;
    final tokens = AuthTokens.fromJson(payload['tokens'] as Map<String, dynamic>);
    final user = User.fromJson(payload['user'] as Map<String, dynamic>);
    session.setTokens(tokens);
    await tokenStorage.writeTokens(accessToken: tokens.accessToken, refreshToken: tokens.refreshToken);
    return (user, tokens);
  }

  Future<User?> me() async {
    final data = await api.query(
      r'''
query Me {
  me { id email fullName phone username profilePhoto address status role { name } serviceCentre { id centreName } }
}
''',
    );
    final v = data['me'];
    if (v == null) return null;
    return User.fromJson(v as Map<String, dynamic>);
  }

  Future<Customer?> myCustomerProfile() async {
    final data = await api.query(
      r'''
query MyProfile {
  myCustomerProfile { id fullName phone email address customerType notes }
}
''',
    );
    final v = data['myCustomerProfile'];
    if (v == null) return null;
    return Customer.fromJson(v as Map<String, dynamic>);
  }

  Future<Customer> updateMyProfile({
    String? fullName,
    String? phone,
    String? address,
    String? customerType,
    String? notes,
  }) async {
    final data = await api.mutate(
      r'''
mutation UpdateMyProfile($input: UpdateMyProfileInput!) {
  updateMyProfile(input: $input) { id fullName phone email address customerType notes }
}
''',
      variables: {
        'input': {
          if (fullName != null) 'fullName': fullName,
          if (phone != null) 'phone': phone,
          if (address != null) 'address': address,
          if (customerType != null) 'customerType': customerType,
          if (notes != null) 'notes': notes,
        }
      },
    );
    return Customer.fromJson(data['updateMyProfile'] as Map<String, dynamic>);
  }

  Future<User> updateMyAccount({
    String? fullName,
    String? phone,
    String? address,
    String? profilePhoto,
  }) async {
    final data = await api.mutate(
      r'''
mutation UpdateMyAccount($input: UpdateMyAccountInput!) {
  updateMyAccount(input: $input) { id email fullName phone username profilePhoto address status role { name } serviceCentre { id centreName } }
}
''',
      variables: {
        'input': {
          if (fullName != null) 'fullName': fullName,
          if (phone != null) 'phone': phone,
          if (address != null) 'address': address,
          if (profilePhoto != null) 'profilePhoto': profilePhoto,
        }
      },
    );
    return User.fromJson(data['updateMyAccount'] as Map<String, dynamic>);
  }

  Future<void> loadTokensFromStorage() async {
    final (access, refresh) = await tokenStorage.readTokens();
    session.accessToken = access;
    session.refreshToken = refresh;
  }

  Future<void> logout() async {
    session.clear();
    await tokenStorage.clear();
  }

  Future<bool> requestCustomerPasswordReset({required String email}) async {
    final data = await api.mutate(
      r'''
mutation RequestReset($email: String!) {
  requestCustomerPasswordReset(email: $email)
}
''',
      variables: {'email': email.trim().toLowerCase()},
    );
    return (data['requestCustomerPasswordReset'] as bool?) ?? false;
  }

  Future<bool> resetCustomerPassword({required String email, required String newPassword}) async {
    final data = await api.mutate(
      r'''
mutation Reset($email: String!, $newPassword: String!) {
  resetCustomerPassword(email: $email, newPassword: $newPassword)
}
''',
      variables: {'email': email.trim().toLowerCase(), 'newPassword': newPassword},
    );
    return (data['resetCustomerPassword'] as bool?) ?? false;
  }
}
