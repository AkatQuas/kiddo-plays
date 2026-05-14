import 'dart:io';

import 'db/database.dart';
import 'api.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart';
import 'package:shelf_router/shelf_router.dart';
import 'package:shelf_static/shelf_static.dart';
import 'package:shelf_swagger_ui/shelf_swagger_ui.dart';

const bool _enableSwagger = const bool.fromEnvironment('ENABLE_SWAGGER', defaultValue: true);

void main() async {
  // Initialize database
  initDatabase();

  final rootRouter = Router()
    ..mount('/', const ApiController().call)
    ..get('/health', _healthCheck);

  if (_enableSwagger) {
    final data = File('public/api.json').readAsStringSync();
    rootRouter
      ..mount('/swagger', SwaggerUI(data, title: 'Ops Tool API'))
      ..mount('/', createStaticHandler('public', defaultDocument: 'index.html',
    serveFilesOutsidePath: false));
  } else {
    rootRouter.mount('/', createStaticHandler('public', defaultDocument: 'index.html',
    serveFilesOutsidePath: false));
  }

  // Configure a pipeline with CORS middleware
  final handler = const Pipeline()
      .addMiddleware(corsMiddleware())
      .addHandler(rootRouter);

  // Use any available host or container IP (usually `0.0.0.0`).
  final ip = InternetAddress.anyIPv4;
  // For running in containers, we respect the PORT environment variable.
  final server = await serve(handler, ip, 8080);

  final url = 'http://${server.address.address}:${server.port}';
  // ignore: avoid_print
  print('Server listening on $url ');
  if (_enableSwagger) {
  print('Swagger: $url/swagger ');
  }
}

Response _healthCheck(Request request) {
  return Response.ok('{"status": "ok"}', headers: {'Content-Type': 'application/json'});
}

Middleware corsMiddleware() {
  return (Handler innerHandler) {
    return (Request request) async {
      if (request.method == 'OPTIONS') {
        return Response.ok('', headers: _corsHeaders);
      }
      final response = await innerHandler(request);
      return response.change(headers: _corsHeaders);
    };
  };
}

const _corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, Content-Type, Authorization',
};
