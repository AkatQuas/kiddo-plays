// GENERATED CODE - DO NOT MODIFY BY HAND

// ignore_for_file: unnecessary_raw_strings

part of 'api.dart';

// **************************************************************************
// RoutingGenerator
// **************************************************************************

Router _$ApiControllerRouter(ApiController service) => Router()
  ..mount('/api-v1/stores', service.stores.call)
  ..mount('/api-v1/versions', service.versions.call)
  ..mount('/api-v1/issues', service.issues.call);
