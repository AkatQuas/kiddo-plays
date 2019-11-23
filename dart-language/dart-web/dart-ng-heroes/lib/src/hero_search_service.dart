import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart';
import 'hero.dart';
import 'logger_service.dart';

class HeroSearchService {
  final Logger _logger;
  final Client _http;
  HeroSearchService(this._http, this._logger);

  Exception _handleError(dynamic e) {
    print(e);
    this._logger.log(e);
    return Exception('Server error; cause: $e');
  }
  dynamic _extractData(Response resp) => json.decode(resp.body)['data'];

  Future<List<Hero>> search(String term) async {
    try {
      final response = await _http.get('app/heroes/?name=$term');
      this._logger.log('good request: app/heroes');
      return (_extractData(response) as List)
        .map((h) => Hero.fromJson(h))
        .toList();
    } catch (e) {
      throw _handleError(e);
    }
  }

}