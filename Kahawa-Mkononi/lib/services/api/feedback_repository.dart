import '../../models/feedback.dart';
import 'graphql_api.dart';

class FeedbackRepository {
  final GraphqlApi api;
  FeedbackRepository(this.api);

  Future<List<FeedbackEntry>> myFeedback() async {
    final data = await api.query(
      r'''
query MyFeedback {
  myFeedback(pagination:{page:1,pageSize:50}) {
    nodes {
      id rating comment createdAt
      order {
        id status createdAt updatedAt
        serviceCentre { id centreName locationName phone status }
        items { id quantity unitPrice lineTotal product { id name description price currency isActive imageUrl } }
        totalAmount currency
      }
    }
  }
}
''',
    );
    final nodes = ((data['myFeedback'] as Map<String, dynamic>)['nodes'] as List<dynamic>? ?? const []);
    return nodes.map((x) => FeedbackEntry.fromJson(x as Map<String, dynamic>)).toList();
  }

  Future<FeedbackEntry> createFeedback({String? orderId, required int rating, String? comment}) async {
    final data = await api.mutate(
      r'''
mutation CreateFeedback($input: CreateFeedbackInput!) {
  createFeedback(input:$input) {
    id rating comment createdAt
    order {
      id status createdAt updatedAt
      serviceCentre { id centreName locationName phone status }
      items { id quantity unitPrice lineTotal product { id name description price currency isActive imageUrl } }
      totalAmount currency
    }
  }
}
''',
      variables: {
        'input': {
          if (orderId != null) 'orderId': orderId,
          'rating': rating,
          if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
        }
      },
    );
    return FeedbackEntry.fromJson(data['createFeedback'] as Map<String, dynamic>);
  }
}

