import 'package:angular_router/angular_router.dart';
import 'dart:async';
import 'package:angular/angular.dart';
import 'hero.dart';
import 'hero_service.dart';
import 'route_paths.dart';

@Component(
  selector: 'my-heroes',
  templateUrl: 'hero_list_component.html',
  styleUrls: ['hero_list_component.css'],
  directives: [coreDirectives],
  providers: [ClassProvider(HeroService)],
  pipes: [commonPipes]
)
class HeroListComponent implements OnInit {
  final title = 'Tour of Heroes';
  final HeroService _heroService;
  final Router _router;
  List<Hero> heroes;
  Hero selected;

  HeroListComponent(this._heroService, this._router);
  void onSelect(Hero hero) => selected = hero;
  Future<void> _getHeroes() async {
    _heroService.getAllSlowly().then((res) => heroes = res);

    // _heroService.getAll().then((res) => heroes = res);

    // heroes = await _heroService.getAll();

    // heroes = _heroService.getAllSync();
  }
  Future<void> add(String name) async {
    name = name.trim();
    if (name.isEmpty) return null;
    heroes.add(await _heroService.create(name));
    selected = null;
  }
  Future<void> delete(Hero hero) async {
    await _heroService.delete(hero.id);
    heroes.remove(hero);
    if (selected == hero) selected = null;
  }

  String _heroUrl(int id) => RoutePaths.hero.toUrl(parameters: {idParam: '$id'});

  void ngOnInit() => _getHeroes();

  Future<NavigationResult> gotoDetail() => _router.navigate(_heroUrl(selected.id));
}
