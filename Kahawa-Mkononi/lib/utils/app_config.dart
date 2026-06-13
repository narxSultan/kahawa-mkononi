class AppConfig {
  static const String _defaultApiUrl = 'https://api.feedbackchap.com/graphql';

  static String get defaultApiUrl {
    return _defaultApiUrl;
  }

  static String get apiUrl {
    const v = String.fromEnvironment('API_URL');
    if (v.isEmpty) return defaultApiUrl;
    return v;
  }

  static String get apiBaseUrl {
    final u = apiUrl.trim();
    if (u.endsWith('/graphql')) return u.substring(0, u.length - '/graphql'.length);
    if (u.endsWith('/graphql/')) return u.substring(0, u.length - '/graphql/'.length);
    return u;
  }

  static String absUrl(String? url) {
    final v = (url ?? '').trim();
    if (v.isEmpty) return '';
    if (v.startsWith('http://') || v.startsWith('https://')) return v;
    if (v.startsWith('/')) return '$apiBaseUrl$v';
    return '$apiBaseUrl/$v';
  }
}
