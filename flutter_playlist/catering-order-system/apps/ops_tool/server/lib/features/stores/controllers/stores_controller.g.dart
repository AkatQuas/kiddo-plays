// GENERATED CODE - DO NOT MODIFY BY HAND

// ignore_for_file: unnecessary_raw_strings

part of 'stores_controller.dart';

// **************************************************************************
// RoutingGenerator
// **************************************************************************

Router _$StoresControllerRouter(StoresController service) => Router()
  ..add('GET', '/', (Request request) async {
    return service.getStores(request);
  })
  ..add('POST', '/', (Request request) async {
    return await service.createStore(request);
  })
  ..add('GET', '/<id>', (Request request, String $id) async {
    return service.getStore(request, $id);
  })
  ..add('PUT', '/<id>', (Request request, String $id) async {
    return await service.updateStore(request, $id);
  })
  ..add('DELETE', '/<id>', (Request request, String $id) async {
    return service.deleteStore(request, $id);
  });
