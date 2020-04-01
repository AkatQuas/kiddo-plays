import 'package:angular_router/angular_router.dart';

import 'route_paths.dart';
import 'login/login_component.template.dart' as login_template;
import 'dashboard/dashboard_component.template.dart' as dashboard_template;
import 'charge/charge_component.template.dart' as charge_template;
import 'history/history_component.template.dart' as history_template;

export 'route_paths.dart';

class Routes {
  static final login = RouteDefinition(
    routePath: RoutePaths.login,
    component:  login_template.LoginComponentNgFactory
  );

  static final dashboard = RouteDefinition(
    routePath: RoutePaths.dashboard,
    component: dashboard_template.DashboardComponentNgFactory
  );

  static final charge = RouteDefinition(
    routePath: RoutePaths.charge,
    component: charge_template.ChargeComponentNgFactory
  );

  static final history = RouteDefinition(
    routePath: RoutePaths.history,
    component: history_template.HistoryComponentNgFactory
  );

  static final all = <RouteDefinition> [
    RouteDefinition.redirect(
      path: '',
      redirectTo: RoutePaths.login.toUrl(),
    ),
    login,
    charge,
    dashboard,
    history
  ];
}