import '../../models/product.dart';
import '../../models/service_centre.dart';
import 'graphql_api.dart';

class CatalogRepository {
  final GraphqlApi api;
  CatalogRepository(this.api);

  Future<List<Product>> products({String search = '', bool onlyActive = true}) async {
    final data = await api.query(
      r'''
query Products($search: String, $onlyActive: Boolean) {
  products(pagination:{page:1,pageSize:50}, search:$search, onlyActive:$onlyActive) {
    nodes { id name description price currency isActive imageUrl }
  }
}
''',
      variables: {
        'search': search.trim().isEmpty ? null : search.trim(),
        'onlyActive': onlyActive,
      },
    );
    final nodes = ((data['products'] as Map<String, dynamic>)['nodes'] as List<dynamic>? ?? const []);
    return nodes.map((x) => Product.fromJson(x as Map<String, dynamic>)).toList();
  }

  Future<List<ServiceCentre>> activeServiceCentres({String search = ''}) async {
    final data = await api.query(
      r'''
query Centres($search: String) {
  serviceCentres(pagination:{page:1,pageSize:100}, search:$search, status: ACTIVE) {
    nodes { id centreName locationName phone status }
  }
}
''',
      variables: {'search': search.trim().isEmpty ? null : search.trim()},
    );
    final nodes = ((data['serviceCentres'] as Map<String, dynamic>)['nodes'] as List<dynamic>? ?? const []);
    return nodes.map((x) => ServiceCentre.fromJson(x as Map<String, dynamic>)).toList();
  }
}
