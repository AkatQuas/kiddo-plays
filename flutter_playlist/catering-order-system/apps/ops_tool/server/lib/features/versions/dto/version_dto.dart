import 'package:json_annotation/json_annotation.dart';

part 'version_dto.g.dart';

@JsonSerializable()
class VersionDto {
  final String id;
  final String version;
  final String description;
  final String createdAt;

  const VersionDto({
    required this.id,
    required this.version,
    required this.description,
    required this.createdAt,
  });

  factory VersionDto.fromJson(Map<String, dynamic> map) => _$VersionDtoFromJson(map);
  Map<String, dynamic> toJson() => _$VersionDtoToJson(this);
}

@JsonSerializable()
class VersionCreateDto {
  final String version;
  final String description;

  const VersionCreateDto({
    required this.version,
    required this.description,
  });

  factory VersionCreateDto.fromJson(Map<String, dynamic> map) => _$VersionCreateDtoFromJson(map);
  Map<String, dynamic> toJson() => _$VersionCreateDtoToJson(this);
}