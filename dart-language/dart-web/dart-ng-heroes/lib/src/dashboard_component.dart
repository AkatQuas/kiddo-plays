import 'package:angular_router/angular_router.dart';
import 'package:angular/angular.dart';

import 'route_paths.dart';
import 'hero.dart';
import 'hero_service.dart';
import 'hero_search_component.dart';
import 'logger_service.dart';

@Component(
  selector: 'my-dashboard',
  templateUrl: 'dashboard_component.html',
  styleUrls: ['dashboard_component.css'],
  directives: [coreDirectives, HeroSearchComponent, routerDirectives],
)
class DashboardComponent implements OnInit {
  List<Hero> heroes;

  final HeroService _heroService;
  final Logger _logger;

  DashboardComponent(this._heroService, this._logger);

  @override
  void ngOnInit() async {
    heroes = (await _heroService.getAll()).skip(1).take(4).toList();
  }

  String heroUrl(int id) => RoutePaths.hero.toUrl(parameters: { idParam: '$id'});
  void printAllLog() => this._logger.logAll();
}