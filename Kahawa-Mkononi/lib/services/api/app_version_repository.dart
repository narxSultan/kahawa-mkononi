import '../../utils/app_config.dart';
import 'graphql_api.dart';

class AppVersionInfo {
  final String latestVersion;
  final int latestBuildNumber;
  final int minSupportedBuildNumber;
  final bool updateRequired;
  final String downloadUrl;
  final String? releaseNotes;

  const AppVersionInfo({
    required this.latestVersion,
    required this.latestBuildNumber,
    required this.minSupportedBuildNumber,
    required this.updateRequired,
    required this.downloadUrl,
    this.releaseNotes,
  });

  factory AppVersionInfo.fromJson(Map<String, dynamic> json) {
    return AppVersionInfo(
      latestVersion: json['latestVersion'] as String? ?? '',
      latestBuildNumber: json['latestBuildNumber'] as int? ?? 0,
      minSupportedBuildNumber: json['minSupportedBuildNumber'] as int? ?? 0,
      updateRequired: json['updateRequired'] as bool? ?? false,
      downloadUrl: json['downloadUrl'] as String? ?? '',
      releaseNotes: json['releaseNotes'] as String?,
    );
  }

  bool get mustUpdate {
    return AppConfig.currentBuildNumber < minSupportedBuildNumber ||
        (updateRequired && AppConfig.currentBuildNumber < latestBuildNumber);
  }
}

class AppVersionRepository {
  final GraphqlApi api;

  AppVersionRepository(this.api);

  Future<AppVersionInfo> appVersion() async {
    final data = await api.query(
      r'''
query AppVersion {
  appVersion {
    latestVersion
    latestBuildNumber
    minSupportedBuildNumber
    updateRequired
    downloadUrl
    releaseNotes
  }
}
''',
      noCache: true,
    );
    return AppVersionInfo.fromJson(data['appVersion'] as Map<String, dynamic>);
  }
}
