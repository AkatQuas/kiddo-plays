from datetime import datetime, timedelta
from typing import TypedDict

from flask import Flask, jsonify
from flask_restful import Api, Resource, abort, reqparse

from flaskr.db import get_db


# 定义一个强类型字典模板：指定每个键的名称和对应值类型
class ITodo(TypedDict):
    id: int
    task: str


def get_todo(id: int) -> ITodo:
    todo = get_db().execute("SELECT * FROM todo WHERE id = ?", (id,)).fetchone()
    if todo is None:
        abort(404, message="Todo {} doesn't exist".format(id))
    return dict(todo)  # type: ignore


parser = reqparse.RequestParser()
parser.add_argument("task", type=str, required=True)
parser.add_argument("due", type=str)


# Todo
# shows a single todo item and lets you delete a todo item
class Todo(Resource):
    def get(self, id: int):
        return jsonify(get_todo(id))

    def delete(self, id: int):
        db = get_db()
        db.execute("DELETE FROM todo WHERE id = ?", (id,))
        db.commit()
        return "", 204

    def put(self, id: int):
        args = parser.parse_args()
        db = get_db()
        cursor = db.execute("UPDATE todo SET task = ? WHERE id = ?", (args["task"], id))
        db.commit()
        if cursor.rowcount == 0:
            abort(404, message="Todo {} not exist".format(id))
        return "", 204


# TodoList
# shows a list of all todos, and lets you POST to add new tasks
class TodoList(Resource):
    def get(self):
        db = get_db()
        list = db.execute("SELECT * FROM todo").fetchall()
        return jsonify([dict(i) for i in list])

    def post(self):
        args = parser.parse_args()
        print(args)
        if args["due"] is None:
            args["due"] = datetime.today().date() + timedelta(days=7)
        db = get_db()
        db.execute(
            "INSERT INTO todo (task, due) VALUES (?, ?)", (args["task"], args["due"])
        )
        db.commit()
        return "", 204


def init_restful(app: Flask):
    api = Api(app, prefix="/api")

    api.add_resource(TodoList, "/todos")
    api.add_resource(Todo, "/todos/<int:id>")
