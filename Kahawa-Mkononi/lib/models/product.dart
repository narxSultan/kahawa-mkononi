class Product {
  final String id;
  final String name;
  final String? description;
  final String price;
  final String currency;
  final bool isActive;
  final String? imageUrl;

  const Product({
    required this.id,
    required this.name,
    required this.price,
    required this.currency,
    required this.isActive,
    this.description,
    this.imageUrl,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      price: (json['price'] as String).toString(),
      currency: json['currency'] as String,
      isActive: json['isActive'] as bool,
      imageUrl: json['imageUrl'] as String?,
    );
  }
}

