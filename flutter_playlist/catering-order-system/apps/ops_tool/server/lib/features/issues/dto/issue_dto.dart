import 'package:json_annotation/json_annotation.dart';

part 'issue_dto.g.dart';

@JsonSerializable()
class IssueDto {
  final String id;
  final String title;
  final String description;
  final String status;
  final String createdAt;

  const IssueDto({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.createdAt,
  });

  factory IssueDto.fromJson(Map<String, dynamic> map) => _$IssueDtoFromJson(map);
  Map<String, dynamic> toJson() => _$IssueDtoToJson(this);
}

@JsonSerializable()
class IssueCreateDto {
  final String title;
  final String description;

  const IssueCreateDto({
    required this.title,
    required this.description,
  });

  factory IssueCreateDto.fromJson(Map<String, dynamic> map) => _$IssueCreateDtoFromJson(map);
  Map<String, dynamic> toJson() => _$IssueCreateDtoToJson(this);
}

@JsonSerializable()
class IssueUpdateDto {
  final String? title;
  final String? description;
  final String? status;

  const IssueUpdateDto({
    this.title,
    this.description,
    this.status,
  });

  factory IssueUpdateDto.fromJson(Map<String, dynamic> map) => _$IssueUpdateDtoFromJson(map);
  Map<String, dynamic> toJson() => _$IssueUpdateDtoToJson(this);
}