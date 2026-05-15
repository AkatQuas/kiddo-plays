// GENERATED CODE - DO NOT MODIFY BY HAND

// ignore_for_file: unnecessary_raw_strings

part of 'issue_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

IssueDto _$IssueDtoFromJson(Map<String, dynamic> json) => IssueDto(
  id: json['id'] as String,
  title: json['title'] as String,
  description: json['description'] as String,
  status: json['status'] as String,
  createdAt: json['createdAt'] as String,
);

Map<String, dynamic> _$IssueDtoToJson(IssueDto instance) => <String, dynamic>{
  'id': instance.id,
  'title': instance.title,
  'description': instance.description,
  'status': instance.status,
  'createdAt': instance.createdAt,
};

IssueCreateDto _$IssueCreateDtoFromJson(Map<String, dynamic> json) =>
    IssueCreateDto(
      title: json['title'] as String,
      description: json['description'] as String,
    );

Map<String, dynamic> _$IssueCreateDtoToJson(IssueCreateDto instance) =>
    <String, dynamic>{
      'title': instance.title,
      'description': instance.description,
    };

IssueUpdateDto _$IssueUpdateDtoFromJson(Map<String, dynamic> json) =>
    IssueUpdateDto(
      title: json['title'] as String?,
      description: json['description'] as String?,
      status: json['status'] as String?,
    );

Map<String, dynamic> _$IssueUpdateDtoToJson(IssueUpdateDto instance) =>
    <String, dynamic>{
      'title': instance.title,
      'description': instance.description,
      'status': instance.status,
    };
