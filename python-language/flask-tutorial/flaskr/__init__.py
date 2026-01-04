import os
import typing as t

from flask import Flask


def create_app(test_config: t.Mapping[str, t.Any] | None = None):
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    # https://flask.palletsprojects.com/en/stable/config/#builtin-configuration-values

    app.config.from_mapping(
        SECRET_KEY="dev",
        DATABASE=os.path.join(app.instance_path, "flaskr.sqlite"),
    )
    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_pyfile("config.py", silent=True)
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    @app.route("/hello")
    def hello():
        return "Hello, 42!"

    from . import db

    db.init_app(app)

    from . import auth

    app.register_blueprint(auth.bp)

    from . import blog

    app.register_blueprint(blog.bp)

    app.add_url_rule("/", endpoint="index")

    from . import api

    api.init_restful(app)

    app.logger.info("🚀 launching!")
    return app
