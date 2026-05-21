import '../../models/product.dart';
import 'graphql_api.dart';

class ProductAdminRepository {
  final GraphqlApi api;
  ProductAdminRepository(this.api);

  Future<Product> create({
    required String name,
    String? description,
    required String price,
    String currency = 'TZS',
    String? imageUrl,
  }) async {
    final data = await api.mutate(
      r'''
mutation CreateProduct($input: CreateProductInput!) {
  createProduct(input:$input) { id name description price currency isActive imageUrl }
}
''',
      variables: {
        'input': {
          'name': name.trim(),
          'description': (description ?? '').trim().isEmpty ? null : description,
          'price': price,
          'currency': currency,
          'imageUrl': (imageUrl ?? '').trim().isEmpty ? null : imageUrl,
        }
      },
    );
    return Product.fromJson(data['createProduct'] as Map<String, dynamic>);
  }

  Future<Product> update({
    required String id,
    String? name,
    String? description,
    bool clearDescription = false,
    String? price,
    String? currency,
    bool? isActive,
    String? imageUrl,
    bool clearImage = false,
  }) async {
    final data = await api.mutate(
      r'''
mutation UpdateProduct($id: ID!, $input: UpdateProductInput!) {
  updateProduct(id:$id, input:$input) { id name description price currency isActive imageUrl }
}
''',
      variables: {
        'id': id,
        'input': {
          if (name != null) 'name': name,
          if (clearDescription) 'description': null,
          if (!clearDescription && description != null) 'description': description,
          if (price != null) 'price': price,
          if (currency != null) 'currency': currency,
          if (isActive != null) 'isActive': isActive,
          if (clearImage) 'imageUrl': null,
          if (!clearImage && imageUrl != null) 'imageUrl': imageUrl,
        }
      },
    );
    return Product.fromJson(data['updateProduct'] as Map<String, dynamic>);
  }

  Future<Product> deactivate({required String id}) async {
    final data = await api.mutate(
      r'''
mutation DeleteProduct($id: ID!) {
  deleteProduct(id:$id) { id name description price currency isActive imageUrl }
}
''',
      variables: {'id': id},
    );
    return Product.fromJson(data['deleteProduct'] as Map<String, dynamic>);
  }

  Future<Product> setActive({required String id, required bool active}) async {
    return update(id: id, isActive: active);
  }
}
