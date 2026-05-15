import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/models.dart';

class ApiClient {
  static const String baseUrl = 'http://localhost:8080';

  final http.Client _client = http.Client();

  // Stores API
  Future<List<Store>> getStores() async {
    final response = await _client.get(Uri.parse('$baseUrl/api-v1/stores/'));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data is List) {
        return data.map((e) => Store.fromJson(e)).toList();
      }
    }
    return [];
  }

  Future<Store?> getStore(String id) async {
    final response = await _client.get(Uri.parse('$baseUrl/api-v1/stores/$id'));
    if (response.statusCode == 200) {
      return Store.fromJson(json.decode(response.body));
    }
    return null;
  }

  Future<Store?> createStore(Store store) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/api-v1/stores/'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'name': store.name,
        'owner': store.owner,
        'address': store.address,
        'phone': store.phone,
        'coopStatus': store.coopStatus,
        'coopExpireAt': store.coopExpireAt,
      }),
    );
    if (response.statusCode == 200) {
      return Store.fromJson(json.decode(response.body));
    }
    return null;
  }

  Future<Store?> updateStore(String id, Store store) async {
    final response = await _client.put(
      Uri.parse('$baseUrl/api-v1/stores/$id'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(store.toJson()),
    );
    if (response.statusCode == 200) {
      return Store.fromJson(json.decode(response.body));
    }
    return null;
  }

  Future<bool> deleteStore(String id) async {
    final response = await _client.delete(Uri.parse('$baseUrl/api-v1/stores/$id'));
    return response.statusCode == 200;
  }

  // Versions API
  Future<List<Version>> getVersions() async {
    final response = await _client.get(Uri.parse('$baseUrl/api-v1/versions/'));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data is List) {
        return data.map((e) => Version.fromJson(e)).toList();
      }
    }
    return [];
  }

  Future<Version?> createVersion(Version version) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/api-v1/versions/'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'version': version.version,
        'description': version.description,
      }),
    );
    if (response.statusCode == 200) {
      return Version.fromJson(json.decode(response.body));
    }
    return null;
  }

  // Issues API
  Future<List<Issue>> getIssues() async {
    final response = await _client.get(Uri.parse('$baseUrl/api-v1/issues/'));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data is List) {
        return data.map((e) => Issue.fromJson(e)).toList();
      }
    }
    return [];
  }

  Future<Issue?> createIssue(Issue issue) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/api-v1/issues/'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'title': issue.title,
        'description': issue.description,
      }),
    );
    if (response.statusCode == 200) {
      return Issue.fromJson(json.decode(response.body));
    }
    return null;
  }

  Future<Issue?> updateIssue(String id, Issue issue) async {
    final response = await _client.put(
      Uri.parse('$baseUrl/api-v1/issues/$id'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'title': issue.title,
        'description': issue.description,
        'status': issue.status,
      }),
    );
    if (response.statusCode == 200) {
      return Issue.fromJson(json.decode(response.body));
    }
    return null;
  }

  void dispose() {
    _client.close();
  }
}