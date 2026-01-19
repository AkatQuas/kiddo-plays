# Bigger FastAPI Application

This is a boilerplate of project structure for bigger fastAPI server, see [Bigger Application](https://fastapi.tiangolo.com/tutorial/bigger-applications)

```bash
.
├── app                  # "app" is a fastAPI server
│   ├── __init__.py      #
│   ├── main.py          # "main" module
│   ├── dependencies.py  # "dependencies" module
│   └── routers          #
│   │   ├── __init__.py  #
│   │   ├── books.py     # "books" submodule
│   │   └── users.py     # "users" submodule
│   └── internal         #
│       ├── __init__.py  #
│       └── admin.py     # "admin" submodule
```

## Development

Start the server then try the http request in [test.http](./test.http)

```bash
fastapi dev --app app
```

## Test

Run `pytest` and check `test/test_main.py` to test these endpoint paths.

## Debug

Check out [.vscode/launch.json](.vscode/launch.json).
