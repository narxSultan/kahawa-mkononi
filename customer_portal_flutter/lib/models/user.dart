class User {
  final String id;
  final String email;
  final String fullName;
  final String? phone;
  final String? username;
  final String? profilePhoto;
  final String? address;
  final String roleName;
  final String? serviceCentreId;
  final String? serviceCentreName;

  const User({
    required this.id,
    required this.email,
    required this.fullName,
    required this.roleName,
    this.phone,
    this.username,
    this.profilePhoto,
    this.address,
    this.serviceCentreId,
    this.serviceCentreName,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    final role = (json['role'] as Map<String, dynamic>?) ?? const {};
    final sc = (json['serviceCentre'] as Map<String, dynamic>?) ?? const {};
    return User(
      id: json['id'] as String,
      email: json['email'] as String,
      fullName: json['fullName'] as String,
      phone: json['phone'] as String?,
      username: json['username'] as String?,
      profilePhoto: json['profilePhoto'] as String?,
      address: json['address'] as String?,
      roleName: role['name'] as String? ?? '',
      serviceCentreId: sc['id'] as String?,
      serviceCentreName: sc['centreName'] as String?,
    );
  }
}
