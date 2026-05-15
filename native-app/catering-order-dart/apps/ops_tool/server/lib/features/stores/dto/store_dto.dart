import 'package:json_annotation/json_annotation.dart';

part 'store_dto.g.dart';

/// 店铺
///
/// Schema: id, name, owner, address, phone, coop_status, coop_expire_at, createdAt
@JsonSerializable()
class StoreDto {
  final String id;
  final String name;
  final String owner;
  final String address;
  final String phone;
  final String coopStatus;
  final String? coopExpireAt;
  final String createdAt;

  const StoreDto({
    required this.id,
    required this.name,
    required this.owner,
    required this.address,
    required this.phone,
    required this.coopStatus,
    this.coopExpireAt,
    required this.createdAt,
  });

  factory StoreDto.fromJson(Map<String, dynamic> map) => _$StoreDtoFromJson(map);
  Map<String, dynamic> toJson() => _$StoreDtoToJson(this);
}

@JsonSerializable()
class StoreCreateDto {
  final String name;
  final String owner;
  final String address;
  final String phone;
  final String coopStatus;
  final String? coopExpireAt;

  const StoreCreateDto({
    required this.name,
    required this.owner,
    required this.address,
    required this.phone,
    required this.coopStatus,
    this.coopExpireAt,
  });

  factory StoreCreateDto.fromJson(Map<String, dynamic> map) => _$StoreCreateDtoFromJson(map);
  Map<String, dynamic> toJson() => _$StoreCreateDtoToJson(this);
}