import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart';
import 'package:http/testing.dart';

import 'src/hero.dart';

class InMemoryDataService extends MockClient {
  static final _initialHeroes = [
    { 'id': 11, 'name': 'Micro phone'},
    { 'id': 12, 'name': 'Xing Ember'},
    { 'id': 13, 'name': 'Zeus Sven'},
    { 'id': 14, 'name': 'Necro Hero'},
    { 'id': 15, 'name': 'Orge Mage'},
    { 'id': 16, 'name': 'Enchanting Temp'},
    { 'id': 17, 'name': 'Exort Wex'},
    { 'id': 18, 'name': 'EMP'},
    { 'id': 19, 'name': 'Tornado'},
  ];
  static List<Hero> _heroesDb;
  static int _nextId;

  static Future<Response> _handler(Request request) async {
    if (_heroesDb == null) resetDb();
    var data;
    switch (request.method) {
      case 'GET':
        final id = int.tryParse(request.url.pathSegments.last);
        if (id != null) {
          data = _heroesDb.firstWhere((hero) => hero.id == id);
        } else {
          String prefix = request.url.queryParameters['name'] ?? '';
          final regExp = RegExp(prefix, caseSensitive: false);
          data = _heroesDb.where((hero) => hero.name.contains(regExp)).toList();
        }
        break;
      case 'POST':
        var name = json.decode(request.body)['name'];
        var newHero = Hero(_nextId++, name);
        _heroesDb.add(newHero);
        data = newHero;
        break;
      case 'PUT':
        var heroChanges = Hero.fromJson(json.decode(request.body));
        var targetHero = _heroesDb.firstWhere((h) => h.id == heroChanges.id);
        targetHero.name = heroChanges.name;
        data = targetHero;
        break;
      case 'DELETE':
        final id = int.tryParse(request.url.pathSegments.last);
        _heroesDb.removeWhere((h) => h.id == id);
        data = true;
        break;
      default:
        throw 'Unimplemented HTTP method ${request.method}';
    }
    return Response(json.encode({'data': data}), 200, headers: { 'content-type': 'application/json'});
  }

  static resetDb() {
    _heroesDb = _initialHeroes.map((h) => Hero.fromJson(h)).toList();
    _nextId = _heroesDb.map((h) => h.id).fold(0, max)+1;
  }
  static String lookUpName(int id) => _heroesDb.firstWhere((h) => h.id == id, orElse: null)?.name;

  InMemoryDataService() : super(_handler);
}