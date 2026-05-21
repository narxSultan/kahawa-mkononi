import '../../models/order.dart';
import 'graphql_api.dart';

class OrderRepository {
  final GraphqlApi api;
  OrderRepository(this.api);

  Future<List<Order>> centreOrders({String? status, String? serviceCentreId}) async {
    final data = await api.query(
      r'''
query Orders($status: OrderStatus, $serviceCentreId: ID) {
  orders(pagination:{page:1,pageSize:50}, status:$status, serviceCentreId:$serviceCentreId) {
    nodes {
      id status createdAt updatedAt
      customer { id fullName phone email }
      transferredAt
      transferredFromServiceCentre { id centreName locationName phone status }
      transferredToServiceCentre { id centreName locationName phone status }
      staffCompletedAt customerAcknowledgedAt customerRejectedAt customerRejectionReason
      staffResponseAt staffResponseMessage
      staffMessageAt staffMessageText
      serviceCentre { id centreName locationName phone status }
      items { id quantity unitPrice lineTotal product { id name description price currency isActive imageUrl } }
      totalAmount currency
    }
  }
}
''',
      variables: {'status': status, 'serviceCentreId': serviceCentreId},
    );
    final nodes = ((data['orders'] as Map<String, dynamic>)['nodes'] as List<dynamic>? ?? const []);
    return nodes.map((x) => Order.fromJson(x as Map<String, dynamic>)).toList();
  }

  Future<Order> staffComplete(String orderId) async {
    final data = await api.mutate(
      r'''
mutation StaffComplete($orderId: ID!) {
  staffCompleteOrder(orderId:$orderId) {
    id status createdAt updatedAt
    customer { id fullName phone email }
    transferredAt
    transferredFromServiceCentre { id centreName locationName phone status }
    transferredToServiceCentre { id centreName locationName phone status }
    staffCompletedAt customerAcknowledgedAt customerRejectedAt customerRejectionReason
    staffResponseAt staffResponseMessage
    staffMessageAt staffMessageText
    serviceCentre { id centreName locationName phone status }
    items { id quantity unitPrice lineTotal product { id name description price currency isActive imageUrl } }
    totalAmount currency
  }
}
''',
      variables: {'orderId': orderId},
    );
    return Order.fromJson(data['staffCompleteOrder'] as Map<String, dynamic>);
  }

  Future<Order> staffMessage({required String orderId, required String message}) async {
    final data = await api.mutate(
      r'''
mutation StaffMessage($orderId: ID!, $message: String!) {
  staffMessageOrder(orderId:$orderId, message:$message) {
    id status createdAt updatedAt
    customer { id fullName phone email }
    transferredAt
    transferredFromServiceCentre { id centreName locationName phone status }
    transferredToServiceCentre { id centreName locationName phone status }
    staffCompletedAt customerAcknowledgedAt customerRejectedAt customerRejectionReason
    staffResponseAt staffResponseMessage
    staffMessageAt staffMessageText
    serviceCentre { id centreName locationName phone status }
    items { id quantity unitPrice lineTotal product { id name description price currency isActive imageUrl } }
    totalAmount currency
  }
}
''',
      variables: {'orderId': orderId, 'message': message},
    );
    return Order.fromJson(data['staffMessageOrder'] as Map<String, dynamic>);
  }

  Future<Order> staffRespondRejection({required String orderId, required String message}) async {
    final data = await api.mutate(
      r'''
mutation StaffRespond($orderId: ID!, $message: String!) {
  staffRespondOrderRejection(orderId:$orderId, message:$message) {
    id status createdAt updatedAt
    customer { id fullName phone email }
    transferredAt
    transferredFromServiceCentre { id centreName locationName phone status }
    transferredToServiceCentre { id centreName locationName phone status }
    staffCompletedAt customerAcknowledgedAt customerRejectedAt customerRejectionReason
    staffResponseAt staffResponseMessage
    staffMessageAt staffMessageText
    serviceCentre { id centreName locationName phone status }
    items { id quantity unitPrice lineTotal product { id name description price currency isActive imageUrl } }
    totalAmount currency
  }
}
''',
      variables: {'orderId': orderId, 'message': message},
    );
    return Order.fromJson(data['staffRespondOrderRejection'] as Map<String, dynamic>);
  }

  Future<List<Order>> myOrders({String? status}) async {
    final data = await api.query(
      r'''
query MyOrders($status: OrderStatus) {
  myOrders(pagination:{page:1,pageSize:50}, status:$status) {
    nodes {
      id status createdAt updatedAt
      transferredAt
      transferredFromServiceCentre { id centreName locationName phone status }
      transferredToServiceCentre { id centreName locationName phone status }
      staffCompletedAt customerAcknowledgedAt customerRejectedAt customerRejectionReason
      staffResponseAt staffResponseMessage
      staffMessageAt staffMessageText
      serviceCentre { id centreName locationName phone status }
      items { id quantity unitPrice lineTotal product { id name description price currency isActive imageUrl } }
      totalAmount currency
    }
  }
}
''',
      variables: {'status': status},
    );
    final nodes = ((data['myOrders'] as Map<String, dynamic>)['nodes'] as List<dynamic>? ?? const []);
    return nodes.map((x) => Order.fromJson(x as Map<String, dynamic>)).toList();
  }

  Future<Order> createOrder({required String productId, required int quantity, required String serviceCentreId}) async {
    final data = await api.mutate(
      r'''
mutation CreateOrder($input: CreateOrderInput!) {
  createOrder(input:$input) {
    id status createdAt updatedAt
    transferredAt
    transferredFromServiceCentre { id centreName locationName phone status }
    transferredToServiceCentre { id centreName locationName phone status }
    staffCompletedAt customerAcknowledgedAt customerRejectedAt customerRejectionReason
    staffResponseAt staffResponseMessage
    staffMessageAt staffMessageText
    serviceCentre { id centreName locationName phone status }
    items { id quantity unitPrice lineTotal product { id name description price currency isActive imageUrl } }
    totalAmount currency
  }
}
''',
      variables: {
        'input': {'productId': productId, 'quantity': quantity, 'serviceCentreId': serviceCentreId}
      },
    );
    return Order.fromJson(data['createOrder'] as Map<String, dynamic>);
  }

  Future<Order> cancelMyOrder(String orderId) async {
    final data = await api.mutate(
      r'''
mutation Cancel($orderId: ID!) {
  cancelMyOrder(orderId:$orderId) {
    id status createdAt updatedAt
    transferredAt
    transferredFromServiceCentre { id centreName locationName phone status }
    transferredToServiceCentre { id centreName locationName phone status }
    serviceCentre { id centreName locationName phone status }
    items { id quantity unitPrice lineTotal product { id name description price currency isActive imageUrl } }
    totalAmount currency
  }
}
''',
      variables: {'orderId': orderId},
    );
    return Order.fromJson(data['cancelMyOrder'] as Map<String, dynamic>);
  }

  Future<Order> updateMyOrder({
    required String orderId,
    String? productId,
    int? quantity,
    String? serviceCentreId,
  }) async {
    final data = await api.mutate(
      r'''
mutation Update($orderId: ID!, $input: UpdateMyOrderInput!) {
  updateMyOrder(orderId:$orderId, input:$input) {
    id status createdAt updatedAt
    transferredAt
    transferredFromServiceCentre { id centreName locationName phone status }
    transferredToServiceCentre { id centreName locationName phone status }
    serviceCentre { id centreName locationName phone status }
    items { id quantity unitPrice lineTotal product { id name description price currency isActive imageUrl } }
    totalAmount currency
  }
}
''',
      variables: {
        'orderId': orderId,
        'input': {
          if (productId != null) 'productId': productId,
          if (quantity != null) 'quantity': quantity,
          if (serviceCentreId != null) 'serviceCentreId': serviceCentreId,
        }
      },
    );
    return Order.fromJson(data['updateMyOrder'] as Map<String, dynamic>);
  }

  Future<Order> acknowledgeOrder(String orderId) async {
    final data = await api.mutate(
      r'''
mutation Ack($orderId: ID!) {
  acknowledgeOrder(orderId:$orderId) {
    id status createdAt updatedAt
    transferredAt
    transferredFromServiceCentre { id centreName locationName phone status }
    transferredToServiceCentre { id centreName locationName phone status }
    staffCompletedAt customerAcknowledgedAt
    serviceCentre { id centreName locationName phone status }
    items { id quantity unitPrice lineTotal product { id name description price currency isActive imageUrl } }
    totalAmount currency
  }
}
''',
      variables: {'orderId': orderId},
    );
    return Order.fromJson(data['acknowledgeOrder'] as Map<String, dynamic>);
  }

  Future<Order> rejectOrder({required String orderId, required String reason}) async {
    final data = await api.mutate(
      r'''
mutation Reject($orderId: ID!, $reason: String!) {
  rejectOrder(orderId:$orderId, reason:$reason) {
    id status createdAt updatedAt
    transferredAt
    transferredFromServiceCentre { id centreName locationName phone status }
    transferredToServiceCentre { id centreName locationName phone status }
    customerRejectedAt customerRejectionReason
    serviceCentre { id centreName locationName phone status }
    items { id quantity unitPrice lineTotal product { id name description price currency isActive imageUrl } }
    totalAmount currency
  }
}
''',
      variables: {'orderId': orderId, 'reason': reason},
    );
    return Order.fromJson(data['rejectOrder'] as Map<String, dynamic>);
  }

  Future<Order> transferOrder({required String orderId, required String serviceCentreId}) async {
    final data = await api.mutate(
      r'''
mutation Transfer($orderId: ID!, $serviceCentreId: ID!) {
  transferOrder(orderId:$orderId, serviceCentreId:$serviceCentreId) {
    id status createdAt updatedAt
    customer { id fullName phone email }
    transferredAt
    transferredFromServiceCentre { id centreName locationName phone status }
    transferredToServiceCentre { id centreName locationName phone status }
    staffCompletedAt customerAcknowledgedAt customerRejectedAt customerRejectionReason
    staffResponseAt staffResponseMessage
    staffMessageAt staffMessageText
    serviceCentre { id centreName locationName phone status }
    items { id quantity unitPrice lineTotal product { id name description price currency isActive imageUrl } }
    totalAmount currency
  }
}
''',
      variables: {'orderId': orderId, 'serviceCentreId': serviceCentreId},
    );
    return Order.fromJson(data['transferOrder'] as Map<String, dynamic>);
  }

  Future<bool> deleteOrder(String orderId) async {
    final data = await api.mutate(
      r'''
mutation DeleteOrder($orderId: ID!) {
  deleteOrder(orderId:$orderId)
}
''',
      variables: {'orderId': orderId},
    );
    return (data['deleteOrder'] as bool?) ?? false;
  }
}
