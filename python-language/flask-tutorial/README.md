Remember to create a virtual environment before install dependencies.

# Flaskr

It's a project from [flask tutorial](https://flask.palletsprojects.com/en/stable/tutorial/).

## Development

1. Initialized the database.

```bash
flask --app flaskr init-db
```

2. Start the server.

```bash
flask --app flaskr
```

3. Visit `http://localhost:5000/auth/register`.

## RestFul Server

Most handlers are in [api.py](./flaskr/api.py) leveraging [flask-restful](https://flask-restful.readthedocs.io/).

We have some typing and serialization / deserialization issues since the `row_factory` is set to `sqlite3.Row`.

## Test

Install this project before running test.

```bash
pip install -e .
```

Run the test!

```bash
pytest

# detailed function execution
pytest -v
```

Coverage statistics.

```bash
coverage run -m pytest

coverage report
```

## Deployment

Use `build` to build a wheel file.


```bash
pip install build

python -m build --wheel
```

See [Deploying to Production](https://flask.palletsprojects.com/en/stable/deploying/) for a list of many different ways to host the flask application.
