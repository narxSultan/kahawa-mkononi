import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dependencies.dart';

final appLogoUrlProvider = FutureProvider<String?>((ref) async {
  return ref.watch(brandingRepositoryProvider).appLogoUrl();
});

