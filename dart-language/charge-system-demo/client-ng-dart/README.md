# client_ng_dart

Charge System Client written in Dart using [AngularDart](https://webdev.dartlang.org/angular) and
[AngularDart Components](https://webdev.dartlang.org/components).

The developing pracitce is still evolving. Just stay tuned.

## Tips

**Proxy**:

Literally, there is no proxy at all.

There is no such guide online on how to proxy http request to the server side, so I use the [full request url](lib/src/uri_service.dart). The backend is already avaliable for CORS.

And there seems to be a problem on `OPTIONS` request to the server, hard to debug this at the moment.

But the server works fine with AngularJS projects.
