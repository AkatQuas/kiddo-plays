import 'dart:io';
import 'dart:convert';
import 'package:path/path.dart' as path;
import 'dart:async';
import 'package:args/args.dart';
import 'package:jaguar/jaguar.dart';
import 'package:jaguar_cors/jaguar_cors.dart';
import 'package:jaguar_reflect/jaguar_reflect.dart';
import 'package:jaguar_session_jwt/jaguar_session_jwt.dart';
import 'package:dartis/dartis.dart' as redis;

String rootPath;
redis.Client redisClient;
redis.Commands strCmd;
redis.Commands listCmd;

final jwtConfig = JwtConfig(
  "dgdfgdwsrtnretlkj6h5467kjh4567kjh32k4h532jh5435",
);

final corsOptions = CorsOptions(
    allowAllHeaders: true,
    allowAllMethods: true,
    allowAllOrigins: true);

main(List<String> args) async {
  var parser = ArgParser()..addOption('port', abbr: 'p', defaultsTo: '9090');

  var result = parser.parse(args);

  var port = int.tryParse(result['port']);

  if (port == null) {
    stdout.writeln(
        'Could not parse port value "${result['port']}" into a number.');
    exitCode = 64;
    return;
  }

  rootPath = getRootDirectory();
  final String connectionString = 'redis://localhost:6379';
  redisClient = await redis.Client.connect(connectionString);
  strCmd = redisClient.asCommands<String, String>();
  listCmd = redisClient.asCommands<String, List<dynamic>>();

  final redisOK = await initRedis();
  if (redisOK == true) {
    startServer(port);
  } else {
    print('something error with redis, cannot start the server!');
  }
}

Future<bool> initRedis() async {
  try {
    await strCmd.flushall();
    final files = ['user', 'charge_choices', 'charge_history'];
    files.forEach((name) {
      var file = new File(path.join(rootPath, 'lib/data-sample/$name.json'));
      file.readAsString().then((content) async {
        await strCmd.set(redisKey(name), content);
      });
    });
    return true;
  } catch (e) {
    print(e);
    return false;
  }
}

void startServer(port) async {
  final server = new Jaguar(
      port: port,
      );
      // sessionManager: JwtSession(jwtConfig, io: SessionIoAuthHeader()));

  server.add(reflect(LoginApi()));
  server.add(reflect(ChoicesApi()));
  server.add(reflect(HistoryApi()));
  server.add(reflect(ChargeApi()));

  server.log.onRecord.listen(print);
  await server.serve();
  print('Serving at http://localhost:$port');
}

// utilities

String redisKey(key) => 'charge_system_$key';

String getRootDirectory() {
  Uri uri = Platform.script;
  String utilPath = uri.toFilePath();
  return path.normalize(path.join(utilPath, '../../'));
}

String getTime() {
  DateTime today = new DateTime.now();
  return '${today.year.toString()}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')} ${today.hour.toString().padLeft(2, '0')}:${today.minute.toString().padLeft(2, '0')}';
}

// reponses

Response makeResponse({dynamic data = null, int code, String message}) {
  if (data != null) {
    return Response.json({'data': data, 'message': null});
  } else {
    return Response.json({'data': null, 'message': message}, statusCode: code);
  }
}

Response makeSp({dynamic data = true}) {
  return makeResponse(data: data);
}

Response makeEp(
    {String message = 'internal server error',
    int code = HttpStatus.internalServerError}) {
  return makeResponse(code: code, message: message);
}

// api routes

class CorsController extends Controller {
  @override
  void before(Context ctx) {
    cors(ctx, corsOptions);
  }
}

@GenController(path: '/api/login')
class LoginApi extends CorsController {
  @HttpMethod(methods: const ['POST', 'OPTIONS'])
  Future<Response<String>> post(Context ctx) async {
    final Map<String, dynamic> body = await ctx.bodyAsJsonMap();
    final List userList = await strCmd
        .get(redisKey('user'))
        .then((source) => json.decode(source).toList());
    try {
      final targetUser =
          userList.firstWhere((item) => item['username'] == body['username']);
      if (targetUser['password'] == body['password']) {
        return makeSp();
      } else {
        return makeEp(
            code: HttpStatus.badRequest, message: 'password incorrect');
      }
    } catch (e) {
      return makeEp(code: HttpStatus.badRequest, message: 'username not exist');
    }
  }
}

@GenController(path: '/api/choices')
class ChoicesApi extends CorsController {
  @HttpMethod(methods: const ['GET'])
  Future<Response<String>> get(Context ctx) async {
    try {
      final List data = await strCmd
          .get(redisKey('charge_choices'))
          .then((source) => json.decode(source).toList());
      return makeSp(data: data);
    } catch (e) {
      return makeEp(code: HttpStatus.notFound, message: 'data retrive failed');
    }
  }
}

@GenController(path: '/api/history')
class HistoryApi extends CorsController {
  @HttpMethod(methods: const ['GET'])
  Future<Response<String>> get(Context ctx) async {
    try {
      final List data = await strCmd
          .get(redisKey('charge_history'))
          .then((source) => json.decode(source).toList());
      return makeSp(data: data);
    } catch (e) {
      return makeEp(code: HttpStatus.notFound, message: 'data retrive failed');
    }
  }
}

@GenController(path: '/api/charge')
class ChargeApi extends CorsController {
  @HttpMethod(methods: const ['POST', 'OPTIONS'])
  Future<Response<String>> post(Context ctx) async {
    try {
      final Map<String, dynamic> body = await ctx.bodyAsJsonMap();
      final historyKey = redisKey('charge_history');
      List data = await strCmd
          .get(historyKey)
          .then((source) => json.decode(source).toList());
      final time = getTime();
      data.insert(0, {'time': time, 'value': body['value']});
      await strCmd.set(historyKey, json.encode(data));
      return makeSp();
    } catch (e) {
      return makeEp(
          code: HttpStatus.internalServerError, message: 'charge failed');
    }
  }
}
