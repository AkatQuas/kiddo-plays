// GENERATED CODE - DO NOT MODIFY BY HAND

// ignore_for_file: unnecessary_raw_strings

part of 'versions_controller.dart';

// **************************************************************************
// RoutingGenerator
// **************************************************************************

Router _$VersionsControllerRouter(VersionsController service) => Router()
  ..add('GET', '/', (Request request) async {
    return service.getVersions(request);
  })
  ..add('POST', '/', (Request request) async {
    return await service.createVersion(request);
  });
