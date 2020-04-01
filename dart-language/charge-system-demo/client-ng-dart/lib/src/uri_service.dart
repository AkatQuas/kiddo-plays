class UriService {
  Uri formatUri(path) {
    Uri uri = Uri(
      scheme: 'http',
      host: 'localhost',
      port: 9090,
      path: path,
    );
    return uri;
  }
}
