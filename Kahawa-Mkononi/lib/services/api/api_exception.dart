class ApiException implements Exception {
  final String code;
  final String message;

  const ApiException(this.code, this.message);

  @override
  String toString() => 'ApiException($code): $message';
}

