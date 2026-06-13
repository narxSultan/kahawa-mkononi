import '../../models/auth_tokens.dart';

class AuthSession {
  String? accessToken;
  String? refreshToken;

  bool get isSignedIn => (accessToken ?? '').isNotEmpty && (refreshToken ?? '').isNotEmpty;

  void setTokens(AuthTokens tokens) {
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
  }

  void clear() {
    accessToken = null;
    refreshToken = null;
  }
}

