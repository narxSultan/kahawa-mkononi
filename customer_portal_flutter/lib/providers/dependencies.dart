import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/api/auth_repository.dart';
import '../services/api/auth_session.dart';
import '../services/api/catalog_repository.dart';
import '../services/api/branding_repository.dart';
import '../services/api/feedback_repository.dart';
import '../services/api/graphql_api.dart';
import '../services/api/notification_repository.dart';
import '../services/api/order_repository.dart';
import '../services/api/product_admin_repository.dart';
import '../services/api/upload_repository.dart';
import '../services/api/token_storage.dart';

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return TokenStorage(ref.watch(secureStorageProvider));
});

final authSessionProvider = Provider<AuthSession>((ref) {
  return AuthSession();
});

final graphqlApiProvider = Provider<GraphqlApi>((ref) {
  return GraphqlApi(session: ref.watch(authSessionProvider), tokenStorage: ref.watch(tokenStorageProvider), debug: true);
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(api: ref.watch(graphqlApiProvider), tokenStorage: ref.watch(tokenStorageProvider), session: ref.watch(authSessionProvider));
});

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) => CatalogRepository(ref.watch(graphqlApiProvider)));
final brandingRepositoryProvider = Provider<BrandingRepository>((ref) => BrandingRepository(ref.watch(graphqlApiProvider)));
final orderRepositoryProvider = Provider<OrderRepository>((ref) => OrderRepository(ref.watch(graphqlApiProvider)));
final productAdminRepositoryProvider = Provider<ProductAdminRepository>((ref) => ProductAdminRepository(ref.watch(graphqlApiProvider)));
final notificationRepositoryProvider = Provider<NotificationRepository>((ref) => NotificationRepository(ref.watch(graphqlApiProvider)));
final feedbackRepositoryProvider = Provider<FeedbackRepository>((ref) => FeedbackRepository(ref.watch(graphqlApiProvider)));
final uploadRepositoryProvider = Provider<UploadRepository>((ref) => UploadRepository(session: ref.watch(authSessionProvider), api: ref.watch(graphqlApiProvider)));
