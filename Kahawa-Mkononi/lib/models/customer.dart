class Customer {
  final String id;
  final String fullName;
  final String phone;
  final String? email;
  final String? address;
  final String? customerType;
  final String? notes;

  const Customer({
    required this.id,
    required this.fullName,
    required this.phone,
    this.email,
    this.address,
    this.customerType,
    this.notes,
  });

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: json['id'] as String,
      fullName: json['fullName'] as String,
      phone: json['phone'] as String,
      email: json['email'] as String?,
      address: json['address'] as String?,
      customerType: json['customerType'] as String?,
      notes: json['notes'] as String?,
    );
  }
}

