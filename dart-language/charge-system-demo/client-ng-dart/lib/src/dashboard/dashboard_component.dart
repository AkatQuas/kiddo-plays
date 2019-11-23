import 'package:angular/angular.dart';
import 'package:angular_router/angular_router.dart';
import '../user_service.dart';
import '../route_paths.dart';

@Component(
  selector: 'my-dashbord',
  styleUrls: ['dashboard_component.css'],
  templateUrl: 'dashboard_component.html',
  directives: [coreDirectives],
)
class DashboardComponent implements OnInit {
  final UserService userService;
  String username = '';
  final Router _router;

  DashboardComponent(this.userService, this._router);

 void ngOnInit() async {
   getCurrentUser();
 }
 void getCurrentUser() {
   username = userService.getCurrentUser();
 }
 void navCharge() {
    _router.navigate(RoutePaths.charge.toUrl());
 }
 void navHistory() {
    _router.navigate(RoutePaths.history.toUrl());
 }
 void logout() {
   final res  = userService.logout();
   if (res) {
    _router.navigate(RoutePaths.login.toUrl());
   }
 }
}