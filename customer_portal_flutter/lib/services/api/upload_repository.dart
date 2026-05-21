import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../../utils/app_config.dart';
import 'api_exception.dart';
import 'auth_session.dart';
import 'graphql_api.dart';

class UploadRepository {
  final AuthSession session;
  final GraphqlApi api;
  UploadRepository({required this.session, required this.api});

  Future<String> uploadProfilePhoto({required Uint8List bytes, required String filename, required MediaType contentType}) {
    return _upload(endpointPath: '/upload/profile', bytes: bytes, filename: filename, contentType: contentType, allowRefresh: true);
  }

  Future<String> uploadSystemLogo({required Uint8List bytes, required String filename, required MediaType contentType}) {
    return _upload(endpointPath: '/upload', bytes: bytes, filename: filename, contentType: contentType, allowRefresh: true);
  }

  Future<String> uploadProductImage({required Uint8List bytes, required String filename, required MediaType contentType}) {
    return _upload(endpointPath: '/upload', bytes: bytes, filename: filename, contentType: contentType, allowRefresh: true);
  }

  Future<String> _upload({
    required String endpointPath,
    required Uint8List bytes,
    required String filename,
    required MediaType contentType,
    required bool allowRefresh,
  }) async {
    Future<(int status, String body)> sendWithToken(String token) async {
      final uri = Uri.parse('${AppConfig.apiBaseUrl}$endpointPath');
      final req = http.MultipartRequest('POST', uri);
      req.headers['Authorization'] = 'Bearer $token';
      req.files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename, contentType: contentType));
      final res = await req.send();
      final body = await res.stream.bytesToString();
      return (res.statusCode, body);
    }

    var token = (session.accessToken ?? '').trim();
    if (token.isEmpty) throw const ApiException('UNAUTHORIZED', 'Session expired. Please sign in again.');

    var (status, body) = await sendWithToken(token);
    if (status == 401 && allowRefresh) {
      await api.refreshTokens();
      token = (session.accessToken ?? '').trim();
      if (token.isEmpty) throw const ApiException('UNAUTHORIZED', 'Session expired. Please sign in again.');
      (status, body) = await sendWithToken(token);
    }

    if (status < 200 || status >= 300) {
      final details = body.isEmpty ? 'Upload failed ($status).' : body;
      throw ApiException('UPLOAD_FAILED', details);
    }

    final json = jsonDecode(body) as Map<String, dynamic>;
    final url = (json['url'] as String?)?.trim() ?? '';
    if (url.isEmpty) throw const ApiException('UPLOAD_FAILED', 'Missing upload URL.');
    return url;
  }
}
