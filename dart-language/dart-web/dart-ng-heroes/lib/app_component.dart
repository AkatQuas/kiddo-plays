import 'package:angular/angular.dart';
import 'package:angular_router/angular_router.dart';

import 'src/routes.dart';
import 'src/hero_service.dart';
import 'src/logger_service.dart';

@Component(
  selector: 'my-app',
  templateUrl: 'app_component.html',
  styleUrls: ['app_component.css'],
  directives: [routerDirectives],
  providers: [ClassProvider(HeroService), ClassProvider(Logger)],
  exports: [RoutePaths, Routes],
)
class AppComponent {
  var name = 'world';
  final title = 'Tour of Heroes';
}
