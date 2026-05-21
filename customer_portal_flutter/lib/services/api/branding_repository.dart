import 'graphql_api.dart';

class BrandingRepository {
  final GraphqlApi api;
  BrandingRepository(this.api);

  Future<String?> appLogoUrl() async {
    final data = await api.query(
      r'''
query Branding {
  appBranding { logoUrl }
}
''',
    );
    final branding = data['appBranding'] as Map<String, dynamic>? ?? const {};
    final url = (branding['logoUrl'] as String?)?.trim() ?? '';
    return url.isEmpty ? null : url;
  }

  Future<String?> setAppLogoUrl(String? logoUrl) async {
    final v = (logoUrl ?? '').trim();
    final data = await api.mutate(
      r'''
mutation SetLogo($logoUrl: String) {
  setAppBranding(logoUrl: $logoUrl) { logoUrl }
}
''',
      variables: {'logoUrl': v.isEmpty ? null : v},
    );
    final branding = data['setAppBranding'] as Map<String, dynamic>? ?? const {};
    final url = (branding['logoUrl'] as String?)?.trim() ?? '';
    return url.isEmpty ? null : url;
  }
}
