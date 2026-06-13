class ServiceCentre {
  final String id;
  final String centreName;
  final String? locationName;
  final String? phone;
  final String status;

  const ServiceCentre({
    required this.id,
    required this.centreName,
    required this.status,
    this.locationName,
    this.phone,
  });

  factory ServiceCentre.fromJson(Map<String, dynamic> json) {
    return ServiceCentre(
      id: json['id'] as String,
      centreName: json['centreName'] as String,
      status: json['status'] as String,
      locationName: json['locationName'] as String?,
      phone: json['phone'] as String?,
    );
  }
}

