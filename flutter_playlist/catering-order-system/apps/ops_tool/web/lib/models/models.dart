class Store {
  final String id;
  final String name;
  final String owner;
  final String address;
  final String phone;
  final String coopStatus;
  final String? coopExpireAt;
  final String createdAt;

  Store({
    required this.id,
    required this.name,
    required this.owner,
    required this.address,
    required this.phone,
    required this.coopStatus,
    this.coopExpireAt,
    required this.createdAt,
  });

  factory Store.fromJson(Map<String, dynamic> json) {
    return Store(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      owner: json['owner']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      coopStatus: json['coopStatus']?.toString() ?? 'none',
      coopExpireAt: json['coopExpireAt']?.toString(),
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'owner': owner,
      'address': address,
      'phone': phone,
      'coopStatus': coopStatus,
      'coopExpireAt': coopExpireAt,
    };
  }

  Store copyWith({
    String? id,
    String? name,
    String? owner,
    String? address,
    String? phone,
    String? coopStatus,
    String? coopExpireAt,
    String? createdAt,
  }) {
    return Store(
      id: id ?? this.id,
      name: name ?? this.name,
      owner: owner ?? this.owner,
      address: address ?? this.address,
      phone: phone ?? this.phone,
      coopStatus: coopStatus ?? this.coopStatus,
      coopExpireAt: coopExpireAt ?? this.coopExpireAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

class Version {
  final String id;
  final String version;
  final String description;
  final String createdAt;

  Version({
    required this.id,
    required this.version,
    required this.description,
    required this.createdAt,
  });

  factory Version.fromJson(Map<String, dynamic> json) {
    return Version(
      id: json['id']?.toString() ?? '',
      version: json['version']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'version': version,
      'description': description,
    };
  }
}

class Issue {
  final String id;
  final String title;
  final String description;
  final String status;
  final String createdAt;

  Issue({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.createdAt,
  });

  factory Issue.fromJson(Map<String, dynamic> json) {
    return Issue(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      status: json['status']?.toString() ?? 'open',
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'status': status,
    };
  }

  Issue copyWith({
    String? id,
    String? title,
    String? description,
    String? status,
    String? createdAt,
  }) {
    return Issue(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}