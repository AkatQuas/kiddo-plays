// GENERATED CODE - DO NOT MODIFY BY HAND

// ignore_for_file: unnecessary_raw_strings

part of 'version_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VersionDto _$VersionDtoFromJson(Map<String, dynamic> json) => VersionDto(
  id: json['id'] as String,
  version: json['version'] as String,
  description: json['description'] as String,
  createdAt: json['createdAt'] as String,
);

Map<String, dynamic> _$VersionDtoToJson(VersionDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'version': instance.version,
      'description': instance.description,
      'createdAt': instance.createdAt,
    };

VersionCreateDto _$VersionCreateDtoFromJson(Map<String, dynamic> json) =>
    VersionCreateDto(
      version: json['version'] as String,
      description: json['description'] as String,
    );

Map<String, dynamic> _$VersionCreateDtoToJson(VersionCreateDto instance) =>
    <String, dynamic>{
      'version': instance.version,
      'description': instance.description,
    };
