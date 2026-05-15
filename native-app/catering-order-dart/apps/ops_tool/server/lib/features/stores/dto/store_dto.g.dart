// GENERATED CODE - DO NOT MODIFY BY HAND

// ignore_for_file: unnecessary_raw_strings

part of 'store_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StoreDto _$StoreDtoFromJson(Map<String, dynamic> json) => StoreDto(
  id: json['id'] as String,
  name: json['name'] as String,
  owner: json['owner'] as String,
  address: json['address'] as String,
  phone: json['phone'] as String,
  coopStatus: json['coopStatus'] as String,
  coopExpireAt: json['coopExpireAt'] as String?,
  createdAt: json['createdAt'] as String,
);

Map<String, dynamic> _$StoreDtoToJson(StoreDto instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'owner': instance.owner,
  'address': instance.address,
  'phone': instance.phone,
  'coopStatus': instance.coopStatus,
  'coopExpireAt': instance.coopExpireAt,
  'createdAt': instance.createdAt,
};

StoreCreateDto _$StoreCreateDtoFromJson(Map<String, dynamic> json) =>
    StoreCreateDto(
      name: json['name'] as String,
      owner: json['owner'] as String,
      address: json['address'] as String,
      phone: json['phone'] as String,
      coopStatus: json['coopStatus'] as String,
      coopExpireAt: json['coopExpireAt'] as String?,
    );

Map<String, dynamic> _$StoreCreateDtoToJson(StoreCreateDto instance) =>
    <String, dynamic>{
      'name': instance.name,
      'owner': instance.owner,
      'address': instance.address,
      'phone': instance.phone,
      'coopStatus': instance.coopStatus,
      'coopExpireAt': instance.coopExpireAt,
    };
