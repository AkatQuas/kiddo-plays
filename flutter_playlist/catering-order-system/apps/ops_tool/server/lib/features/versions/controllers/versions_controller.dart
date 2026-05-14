import 'dart:convert';
import '../dto/version_dto.dart';
import '../../../db/database.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf_open_api/shelf_open_api.dart';
import 'package:shelf_router/shelf_router.dart';

part 'versions_controller.g.dart';

class VersionsController {
  const VersionsController();

  Router get router => _$VersionsControllerRouter(this);

  @Route.get('/')
  Response getVersions(Request request) {
    final result = db.select('SELECT * FROM versions ORDER BY createdAt DESC');
    final versions = result.map((e) => VersionDto.fromJson(e)).toList();
    return Response.ok(
      jsonEncode(versions.map((e) => e.toJson()).toList()),
      headers: {'Content-Type': 'application/json'},
    );
  }

  @Route.post('/')
  @OpenApiRouteHttp(requestBody: VersionCreateDto)
  Future<Response> createVersion(Request request) async {
    final body = jsonDecode(await request.readAsString()) as Map<String, dynamic>;
    final dto = VersionCreateDto.fromJson(body);
    final id = DateTime.now().millisecondsSinceEpoch.toString();
    final createdAt = DateTime.now().toIso8601String();

    db.execute(
      'INSERT INTO versions (id, version, description, createdAt) VALUES (?, ?, ?, ?)',
      [id, dto.version, dto.description, createdAt],
    );

    return Response.ok(
      jsonEncode({'id': id, ...dto.toJson(), 'createdAt': createdAt}),
      headers: {'Content-Type': 'application/json'},
    );
  }
}
