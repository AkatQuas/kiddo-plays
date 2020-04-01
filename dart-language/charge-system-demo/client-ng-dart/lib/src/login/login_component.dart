import 'package:angular/angular.dart';
import 'package:angular_forms/angular_forms.dart';
import '../user_service.dart';

@Component(
  selector: 'my-login',
  styleUrls: ['login_component.css'],
  templateUrl: 'login_component.html',
  directives: [coreDirectives, formDirectives],
)
class LoginComponent {
  final UserService userService;
  String username = '';
  String password = '';

  LoginComponent(this.userService);

  void login() async {
    await this.userService.login(username, password);
    print(1);
  }

}