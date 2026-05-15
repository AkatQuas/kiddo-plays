import 'package:shelf/shelf.dart';
import 'package:shelf_open_api/shelf_open_api.dart';
import 'package:shelf_router/shelf_router.dart';

import 'features/stores/controllers/stores_controller.dart';
import 'features/versions/controllers/versions_controller.dart';
import 'features/issues/controllers/issues_controller.dart';

part 'api.g.dart';

@OpenApiFile()
class ApiController {
  static const _version = '/api-v1';

  const ApiController();

  Router get router => _$ApiControllerRouter(this);

  @Route.mount('$_version/stores')
  @OpenApiRouteMount(StoresController)
  Router get stores => const StoresController().router;

  @Route.mount('$_version/versions')
  @OpenApiRouteMount(VersionsController)
  Router get versions => const VersionsController().router;

  @Route.mount('$_version/issues')
  @OpenApiRouteMount(IssuesController)
  Router get issues => const IssuesController().router;

  Future<Response> call(Request request) => router.call(request);
}
