import 'package:angular/angular.dart';
import 'package:angular_router/angular_router.dart';

import 'src/routes.dart';
import 'src/user_service.dart';
import 'src/charge_service.dart';
import 'src/uri_service.dart';


@Component(
  selector: 'my-app',
  styleUrls: ['app_component.css'],
  templateUrl: 'app_component.html',
  providers: [ClassProvider(UserService), ClassProvider(ChargeService), ClassProvider(UriService)],
  directives: [routerDirectives],
  exports: [RoutePaths, Routes]
)
class AppComponent {
}
