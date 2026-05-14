import 'dart:convert';
import '../dto/store_dto.dart';
import '../../../db/database.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf_open_api/shelf_open_api.dart';
import 'package:shelf_router/shelf_router.dart';

part 'stores_controller.g.dart';

class StoresController {
  const StoresController();

  Router get router => _$StoresControllerRouter(this);

  @Route.get('/')
  Response getStores(Request request) {
    final result = db.select('SELECT * FROM stores ORDER BY createdAt DESC');
    final stores = result.map((e) => _mapToDto(e)).toList();
    return Response.ok(
      jsonEncode(stores.map((e) => e.toJson()).toList()),
      headers: {'Content-Type': 'application/json'},
    );
  }

  @Route.post('/')
  @OpenApiRouteHttp(requestBody: StoreCreateDto)
  Future<Response> createStore(Request request) async {
    final body = jsonDecode(await request.readAsString()) as Map<String, dynamic>;
    final dto = StoreCreateDto.fromJson(body);
    final id = DateTime.now().millisecondsSinceEpoch.toString();
    final createdAt = DateTime.now().toIso8601String();
    final coopStatus = dto.coopStatus.isEmpty ? 'none' : dto.coopStatus;

    db.execute(
      'INSERT INTO stores (id, name, owner, address, phone, coop_status, coop_expire_at, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, dto.name, dto.owner, dto.address, dto.phone, coopStatus, dto.coopExpireAt, createdAt],
    );

    return Response.ok(
      jsonEncode({
        'id': id,
        'name': dto.name,
        'owner': dto.owner,
        'address': dto.address,
        'phone': dto.phone,
        'coopStatus': coopStatus,
        'coopExpireAt': dto.coopExpireAt,
        'createdAt': createdAt,
      }),
      headers: {'Content-Type': 'application/json'},
    );
  }

  @Route.get('/<id>')
  Response getStore(Request request, String id) {
    final result = db.select('SELECT * FROM stores WHERE id = ?', [id]);
    if (result.isEmpty) {
      return Response.notFound('{}', headers: {'Content-Type': 'application/json'});
    }
    return Response.ok(
      jsonEncode(_mapToDto(result.first).toJson()),
      headers: {'Content-Type': 'application/json'},
    );
  }

  @Route.put('/<id>')
  Future<Response> updateStore(Request request, String id) async {
    final body = jsonDecode(await request.readAsString()) as Map<String, dynamic>;
    final fields = <String>[];
    final values = <dynamic>[];

    // Map camelCase to snake_case for database
    final fieldMap = {
      'owner': 'owner',
      'address': 'address',
      'phone': 'phone',
      'coopStatus': 'coop_status',
      'coopExpireAt': 'coop_expire_at',
      'name': 'name',
    };

    for (final entry in body.entries) {
      final dbField = fieldMap[entry.key];
      if (dbField != null) {
        fields.add('$dbField = ?');
        values.add(entry.value);
      }
    }

    if (fields.isNotEmpty) {
      values.add(id);
      db.execute('UPDATE stores SET ${fields.join(', ')} WHERE id = ?', values);
    }

    final result = db.select('SELECT * FROM stores WHERE id = ?', [id]);
    if (result.isEmpty) {
      return Response.notFound('{}', headers: {'Content-Type': 'application/json'});
    }
    return Response.ok(
      jsonEncode(_mapToDto(result.first).toJson()),
      headers: {'Content-Type': 'application/json'},
    );
  }

  @Route.delete('/<id>')
  Response deleteStore(Request request, String id) {
    db.execute('DELETE FROM stores WHERE id = ?', [id]);
    return Response.ok('{"success": true}', headers: {'Content-Type': 'application/json'});
  }

  StoreDto _mapToDto(Map<String, dynamic> map) {
    return StoreDto(
      id: map['id']?.toString() ?? '',
      name: map['name']?.toString() ?? '',
      owner: map['owner']?.toString() ?? '',
      address: map['address']?.toString() ?? '',
      phone: map['phone']?.toString() ?? '',
      coopStatus: map['coop_status']?.toString() ?? 'none',
      coopExpireAt: map['coop_expire_at']?.toString(),
      createdAt: map['createdAt']?.toString() ?? '',
    );
  }
}