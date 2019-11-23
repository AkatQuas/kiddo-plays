import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart';
import 'uri_service.dart';

class UserService {
  static final loginUrl = 'api/login';
  static final _headers = { 'content-type': 'applicationo/json'};
  static String currentUser = '';
  static bool auth = false;
  final Client _http;
  final UriService uriService;

  UserService(this._http, this.uriService);

  Exception _handleError(dynamic e) {
    print(e);
    return Exception('Server error: cause: $e');
  }
  Future<bool> login(String username, String password)  async {
    try {
      Uri url = uriService.formatUri(loginUrl);
      final res = await _http.post(url, headers: _headers, body: json.encode({'username': username, 'password': password}));
      currentUser = username;
      auth = true;
      return true;
    } catch (e) {
      throw _handleError(e);
    }
  }
  bool logout() {
    currentUser = '';
    auth = false;
    return true;
  }
  bool isAuthed() {
    return auth;
  }
  String getCurrentUser() {
    return currentUser;
  }
}