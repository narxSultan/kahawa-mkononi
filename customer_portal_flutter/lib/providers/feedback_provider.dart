import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/feedback.dart';
import 'dependencies.dart';

class FeedbackController extends AutoDisposeAsyncNotifier<List<FeedbackEntry>> {
  @override
  Future<List<FeedbackEntry>> build() async {
    return ref.watch(feedbackRepositoryProvider).myFeedback();
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async => ref.read(feedbackRepositoryProvider).myFeedback());
  }

  Future<void> submit({String? orderId, required int rating, String? comment}) async {
    await ref.read(feedbackRepositoryProvider).createFeedback(orderId: orderId, rating: rating, comment: comment);
    await reload();
  }
}

final feedbackProvider = AutoDisposeAsyncNotifierProvider<FeedbackController, List<FeedbackEntry>>(FeedbackController.new);

