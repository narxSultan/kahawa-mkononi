import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  static const _kAccess = 'kahawa_access_token';
  static const _kRefresh = 'kahawa_refresh_token';

  final FlutterSecureStorage _storage;

  const TokenStorage(this._storage);

  Future<(String? access, String? refresh)> readTokens() async {
    final access = await _storage.read(key: _kAccess);
    final refresh = await _storage.read(key: _kRefresh);
    return (access, refresh);
  }

  Future<void> writeTokens({required String accessToken, required String refreshToken}) async {
    await _storage.write(key: _kAccess, value: accessToken);
    await _storage.write(key: _kRefresh, value: refreshToken);
  }

  Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }
}

