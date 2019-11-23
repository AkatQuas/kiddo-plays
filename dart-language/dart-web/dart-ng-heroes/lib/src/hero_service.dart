import 'dart:async';
import 'dart:convert';
import 'hero.dart';
import 'package:http/http.dart';

import 'mock_heroes.dart';
import 'logger_service.dart';


class HeroService {
  static const _heroesUrl = 'api/heroes';
  static final _headers = { 'content-type': 'applicationo/json'};
  final Client _http;
  final Logger _logger;
  HeroService(this._http, this._logger);

  dynamic _extractData(Response resp) => json.decode(resp.body)['data'];

  Exception _handleError(dynamic e) {
    print(e);
    return Exception('Server error; cause: $e');
  }

  Future<List<Hero>> getAll() async {
    try {
      final response = await _http.get(_heroesUrl);
      final heroes = (_extractData(response) as List)
        .map((h) => Hero.fromJson(h))
        .toList();
      this._logger.log('get all hero success');
      return heroes;
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<Hero> get(int id) async {
    try {
      final response = await _http.get('$_heroesUrl/$id');
      this._logger.log('get hero success, id: $id');
      return Hero.fromJson(_extractData(response));
    } catch (e) {
      throw _handleError(e);
    }
  }
  Future<Hero> update(Hero hero) async {
    try {
      final url = '$_heroesUrl/${hero.id}';
      final response = await _http.put(url, headers: _headers, body: json.encode(hero));
      this._logger.log('update hero success, id: $url');
      return Hero.fromJson(_extractData(response));
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<Hero> create(String name) async {
    try {
      final response = await _http.post(_heroesUrl, headers: _headers, body: json.encode({'name': name}));
      this._logger.log('create hero success, name: $name');
      return Hero.fromJson(_extractData(response));
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> delete(int id) async {
    try {
      final url = '$_heroesUrl/$id';
      await _http.delete(url, headers: _headers);
      this._logger.log('delete hereo success, id: $id');
    } catch (e) {
      throw _handleError(e);
    }
  }

  List<Hero> getAllSync() => mockHeroes;

  Future<List<Hero>> getAllSlowly() async {
    return Future.delayed(Duration(seconds: 2), getAll);
  }

  Future<Hero> getSync(int id) async => (getAllSync()).firstWhere((hero) => hero.id == id);

}
