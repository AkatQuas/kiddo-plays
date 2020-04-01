import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart';
import 'uri_service.dart';

int _toInt(id) => id is int ? id : int.parse(id);

class History {
  String time;
  num value;
  History(this.time, this.value);
  factory History.fromJson(Map<String, dynamic> history) => History(history['time'], _toInt(history['value']));

  Map toJson() => {'time': time, 'value': value};
}

class Choice {
  num id;
  num value;
  Choice(this.id, this.value);
  factory Choice.fromJson(Map<String, dynamic> choice) => Choice(_toInt(choice['id']), _toInt(choice['value']));

  Map toJson() => { 'id': id, 'value': value };
}

class ChargeService {
  static final chargeUrl = 'api/charge';
  static final historyUrl = 'api/history';
  static final choicesUrl = 'api/choices';
  static final _headers = {'content-type': 'applicationo/json'};
  final Client _http;
  final UriService uriService;

  dynamic _extractData(Response res) => json.decode(res.body)['data'];

  ChargeService(this._http, this.uriService);

  Exception _handleError(dynamic e) {
    print(e);
    return Exception('Server error: cause: $e');
  }

  Future<List<Choice>> getChoices() async {
    try {
      Uri url = uriService.formatUri(choicesUrl);
      final res = await _http.get(url);
      final choices = (_extractData(res) as List).map((c) => Choice.fromJson(c)).toList();
      return choices;
    } catch (e) {
      throw _handleError(e);
    }
  }
  Future<List<History>> getHistory() async {
    try {
      Uri url = uriService.formatUri(historyUrl);
      final res = await _http.get(url);
      final histories = (_extractData(res) as List).map((h) => History.fromJson(h)).toList();
      return histories;
    } catch (e) {
      throw _handleError(e);
    }
  }
  Future<bool> postCharge(num value) async {
    try {
      Uri url = uriService.formatUri(chargeUrl);
      final res = await _http.post(url, headers: _headers, body: json.encode({'value': value}));
      final result = _extractData(res);
      print(result);
      return true;
    } catch (e) {
      throw _handleError(e);
    }
  }
}
