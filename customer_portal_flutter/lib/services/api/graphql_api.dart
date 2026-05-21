import 'package:graphql_flutter/graphql_flutter.dart';

import '../../models/auth_tokens.dart';
import '../../utils/app_config.dart';
import 'api_exception.dart';
import 'auth_session.dart';
import 'token_storage.dart';

class GraphqlApi {
  final AuthSession session;
  final TokenStorage tokenStorage;
  final bool debug;

  GraphqlApi({required this.session, required this.tokenStorage, this.debug = false});

  GraphQLClient _client({String? accessToken}) {
    final httpLink = HttpLink(AppConfig.apiUrl);
    Link link = httpLink;
    final token = (accessToken ?? '').trim();
    if (token.isNotEmpty) {
      link = AuthLink(getToken: () async => 'Bearer $token').concat(httpLink);
    }
    return GraphQLClient(cache: GraphQLCache(store: InMemoryStore()), link: link);
  }

  bool _isUnauthorized(OperationException? ex) {
    if (ex == null) return false;
    final msg = [
      ...ex.graphqlErrors.map((e) => e.message),
      if (ex.linkException != null) ex.linkException.toString(),
    ].join(' | ');
    return msg.contains('UNAUTHORIZED') || msg.contains('INVALID_TOKEN') || msg.contains('ACCOUNT_DELETED');
  }

  ApiException _toApiException(OperationException ex) {
    final gql = ex.graphqlErrors.isNotEmpty ? ex.graphqlErrors.first.message : null;
    if (gql != null && gql.trim().isNotEmpty) return ApiException(gql.trim(), gql.trim());
    final link = ex.linkException?.toString() ?? 'NETWORK_ERROR';
    return ApiException('NETWORK_ERROR', link);
  }

  Future<AuthTokens> _refreshOrThrow() async {
    final refresh = (session.refreshToken ?? '').trim();
    if (refresh.isEmpty) throw const ApiException('UNAUTHORIZED', 'Session expired. Please sign in again.');
    final client = _client(accessToken: null);
    final result = await client.mutate(
      MutationOptions(
        document: gql(r'''
mutation Refresh($refreshToken: String!) {
  refresh(refreshToken: $refreshToken) { accessToken refreshToken }
}
'''),
        variables: {'refreshToken': refresh},
        fetchPolicy: FetchPolicy.noCache,
      ),
    );
    if (result.hasException) throw _toApiException(result.exception!);
    final tokensJson = (result.data?['refresh'] as Map<String, dynamic>?);
    if (tokensJson == null) throw const ApiException('INVALID_RESPONSE', 'Missing refresh payload.');
    final tokens = AuthTokens.fromJson(tokensJson);
    session.setTokens(tokens);
    await tokenStorage.writeTokens(accessToken: tokens.accessToken, refreshToken: tokens.refreshToken);
    return tokens;
  }

  Future<AuthTokens> refreshTokens() => _refreshOrThrow();

  Future<Map<String, dynamic>> query(String document, {Map<String, dynamic>? variables, bool noCache = true}) async {
    Future<QueryResult> run({required String? token}) {
      return _client(accessToken: token).query(
        QueryOptions(
          document: gql(document),
          variables: variables ?? const {},
          fetchPolicy: noCache ? FetchPolicy.noCache : FetchPolicy.cacheFirst,
        ),
      );
    }

    if (debug) {
      // ignore: avoid_print
      print('[GraphQL] QUERY -> ${AppConfig.apiUrl} vars=${variables ?? {}}');
    }
    var r = await run(token: session.accessToken);
    if (r.hasException && _isUnauthorized(r.exception)) {
      await _refreshOrThrow();
      r = await run(token: session.accessToken);
    }
    if (r.hasException) {
      if (debug) {
        // ignore: avoid_print
        print('[GraphQL] QUERY exception: ${r.exception}');
      }
      throw _toApiException(r.exception!);
    }
    return r.data ?? const {};
  }

  Future<Map<String, dynamic>> mutate(String document, {Map<String, dynamic>? variables}) async {
    Future<QueryResult> run({required String? token}) {
      return _client(accessToken: token).mutate(
        MutationOptions(
          document: gql(document),
          variables: variables ?? const {},
          fetchPolicy: FetchPolicy.noCache,
        ),
      );
    }

    if (debug) {
      // ignore: avoid_print
      print('[GraphQL] MUTATION -> ${AppConfig.apiUrl} vars=${variables ?? {}}');
    }
    var r = await run(token: session.accessToken);
    if (r.hasException && _isUnauthorized(r.exception)) {
      await _refreshOrThrow();
      r = await run(token: session.accessToken);
    }
    if (r.hasException) {
      if (debug) {
        // ignore: avoid_print
        print('[GraphQL] MUTATION exception: ${r.exception}');
      }
      throw _toApiException(r.exception!);
    }
    return r.data ?? const {};
  }
}
