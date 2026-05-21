import 'order.dart';

class FeedbackEntry {
  final String id;
  final int rating;
  final String? comment;
  final String createdAt;
  final Order? order;

  const FeedbackEntry({
    required this.id,
    required this.rating,
    required this.createdAt,
    this.comment,
    this.order,
  });

  factory FeedbackEntry.fromJson(Map<String, dynamic> json) {
    final o = json['order'] as Map<String, dynamic>?;
    return FeedbackEntry(
      id: json['id'] as String,
      rating: json['rating'] as int,
      comment: json['comment'] as String?,
      createdAt: json['createdAt'] as String,
      order: o == null ? null : Order.fromJson(o),
    );
  }
}

