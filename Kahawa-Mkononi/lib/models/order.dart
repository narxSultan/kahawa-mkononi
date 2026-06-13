import 'product.dart';
import 'service_centre.dart';

class OrderCustomer {
  final String id;
  final String fullName;
  final String? phone;
  final String? email;

  const OrderCustomer({required this.id, required this.fullName, this.phone, this.email});

  factory OrderCustomer.fromJson(Map<String, dynamic> json) {
    return OrderCustomer(
      id: json['id'] as String,
      fullName: json['fullName'] as String? ?? '',
      phone: json['phone'] as String?,
      email: json['email'] as String?,
    );
  }
}

class OrderItem {
  final String id;
  final Product product;
  final int quantity;
  final String unitPrice;
  final String lineTotal;

  const OrderItem({
    required this.id,
    required this.product,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      id: json['id'] as String,
      product: Product.fromJson(json['product'] as Map<String, dynamic>),
      quantity: json['quantity'] as int,
      unitPrice: (json['unitPrice'] as String).toString(),
      lineTotal: (json['lineTotal'] as String).toString(),
    );
  }
}

class Order {
  final String id;
  final String status;
  final OrderCustomer? customer;
  final ServiceCentre? serviceCentre;
  final String? transferredAt;
  final ServiceCentre? transferredFromServiceCentre;
  final ServiceCentre? transferredToServiceCentre;
  final String createdAt;
  final String updatedAt;
  final String? staffMessageText;
  final String? staffMessageAt;
  final String? customerMessageText;
  final String? customerMessageAt;
  final String? staffCompletedAt;
  final String? customerAcknowledgedAt;
  final String? customerRejectedAt;
  final String? customerRejectionReason;
  final String? staffResponseAt;
  final String? staffResponseMessage;
  final List<OrderItem> items;
  final String totalAmount;
  final String currency;

  const Order({
    required this.id,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    required this.items,
    required this.totalAmount,
    required this.currency,
    this.customer,
    this.serviceCentre,
    this.transferredAt,
    this.transferredFromServiceCentre,
    this.transferredToServiceCentre,
    this.staffMessageText,
    this.staffMessageAt,
    this.customerMessageText,
    this.customerMessageAt,
    this.staffCompletedAt,
    this.customerAcknowledgedAt,
    this.customerRejectedAt,
    this.customerRejectionReason,
    this.staffResponseAt,
    this.staffResponseMessage,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    final sc = json['serviceCentre'] as Map<String, dynamic>?;
    final from = json['transferredFromServiceCentre'] as Map<String, dynamic>?;
    final to = json['transferredToServiceCentre'] as Map<String, dynamic>?;
    final cust = json['customer'] as Map<String, dynamic>?;
    final items = (json['items'] as List<dynamic>? ?? const [])
        .map((x) => OrderItem.fromJson(x as Map<String, dynamic>))
        .toList();
    return Order(
      id: json['id'] as String,
      status: json['status'] as String,
      customer: cust == null ? null : OrderCustomer.fromJson(cust),
      serviceCentre: sc == null ? null : ServiceCentre.fromJson(sc),
      transferredAt: json['transferredAt'] as String?,
      transferredFromServiceCentre: from == null ? null : ServiceCentre.fromJson(from),
      transferredToServiceCentre: to == null ? null : ServiceCentre.fromJson(to),
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
      staffMessageText: json['staffMessageText'] as String?,
      staffMessageAt: json['staffMessageAt'] as String?,
      customerMessageText: json['customerMessageText'] as String?,
      customerMessageAt: json['customerMessageAt'] as String?,
      staffCompletedAt: json['staffCompletedAt'] as String?,
      customerAcknowledgedAt: json['customerAcknowledgedAt'] as String?,
      customerRejectedAt: json['customerRejectedAt'] as String?,
      customerRejectionReason: json['customerRejectionReason'] as String?,
      staffResponseAt: json['staffResponseAt'] as String?,
      staffResponseMessage: json['staffResponseMessage'] as String?,
      items: items,
      totalAmount: (json['totalAmount'] as String).toString(),
      currency: json['currency'] as String,
    );
  }
}
