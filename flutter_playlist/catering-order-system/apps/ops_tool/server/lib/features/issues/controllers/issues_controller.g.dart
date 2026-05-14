// GENERATED CODE - DO NOT MODIFY BY HAND

// ignore_for_file: unnecessary_raw_strings

part of 'issues_controller.dart';

// **************************************************************************
// RoutingGenerator
// **************************************************************************

Router _$IssuesControllerRouter(IssuesController service) => Router()
  ..add('GET', '/', (Request request) async {
    return service.getIssues(request);
  })
  ..add('POST', '/', (Request request) async {
    return await service.createIssue(request);
  })
  ..add('PUT', '/<id>', (Request request, String $id) async {
    return await service.updateIssue(request, $id);
  });
