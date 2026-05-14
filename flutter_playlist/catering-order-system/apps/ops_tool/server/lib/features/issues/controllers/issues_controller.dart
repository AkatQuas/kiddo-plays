import 'dart:convert';
import '../dto/issue_dto.dart';
import '../../../db/database.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf_open_api/shelf_open_api.dart';
import 'package:shelf_router/shelf_router.dart';

part 'issues_controller.g.dart';

class IssuesController {
  const IssuesController();

  Router get router => _$IssuesControllerRouter(this);

  @Route.get('/')
  Response getIssues(Request request) {
    final result = db.select('SELECT * FROM issues ORDER BY createdAt DESC');
    final issues = result.map((e) => IssueDto.fromJson(e)).toList();
    return Response.ok(
      jsonEncode(issues.map((e) => e.toJson()).toList()),
      headers: {'Content-Type': 'application/json'},
    );
  }

  @Route.post('/')
  @OpenApiRouteHttp(requestBody: IssueCreateDto)
  Future<Response> createIssue(Request request) async {
    final body = jsonDecode(await request.readAsString()) as Map<String, dynamic>;
    final dto = IssueCreateDto.fromJson(body);
    final id = DateTime.now().millisecondsSinceEpoch.toString();
    final createdAt = DateTime.now().toIso8601String();

    db.execute(
      'INSERT INTO issues (id, title, description, status, createdAt) VALUES (?, ?, ?, ?, ?)',
      [id, dto.title, dto.description, 'open', createdAt],
    );

    return Response.ok(
      jsonEncode({'id': id, ...dto.toJson(), 'status': 'open', 'createdAt': createdAt}),
      headers: {'Content-Type': 'application/json'},
    );
  }

  @Route.put('/<id>')
  Future<Response> updateIssue(Request request, String id) async {
    final body = jsonDecode(await request.readAsString()) as Map<String, dynamic>;
    final fields = body.keys.map((k) => '$k = ?').join(', ');
    final values = [...body.values, id];

    db.execute('UPDATE issues SET $fields WHERE id = ?', values);

    final result = db.select('SELECT * FROM issues WHERE id = ?', [id]);
    if (result.isEmpty) {
      return Response.notFound('{}', headers: {'Content-Type': 'application/json'});
    }
    return Response.ok(
      jsonEncode(IssueDto.fromJson(result.first).toJson()),
      headers: {'Content-Type': 'application/json'},
    );
  }
}
