import 'package:angular_router/angular_router.dart';
const idParam = 'id';

class RoutePaths {
  static final heroes = RoutePath(path: 'heroes');
  static final dashboard = RoutePath(path: 'dashboard');
  static final hero = RoutePath(path: '${heroes.path}/:$idParam');
}