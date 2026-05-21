import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/service_centre.dart';
import 'dependencies.dart';

class ServiceCentresController extends AutoDisposeAsyncNotifier<List<ServiceCentre>> {
  @override
  Future<List<ServiceCentre>> build() async {
    return ref.watch(catalogRepositoryProvider).activeServiceCentres();
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async => ref.read(catalogRepositoryProvider).activeServiceCentres());
  }
}

final serviceCentresProvider = AutoDisposeAsyncNotifierProvider<ServiceCentresController, List<ServiceCentre>>(ServiceCentresController.new);

