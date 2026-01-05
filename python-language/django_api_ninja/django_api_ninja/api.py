from django.http import HttpRequest
from ninja import NinjaAPI, Schema

api = NinjaAPI()

@api.get("/hello")
def hello(request, name:str):
    return f"Hello {name}!"

@api.get("/hello2")
def hello2(request, name="42"):
    return f"Hello {name}!"

@api.get("/math")
def math(request, a: int, b: int):
    return {"add": a + b, "multiply": a * b}

@api.get("/math/{a}and{b}")
def math2(request, a: int, b: int):
    return {"add": a + b, "multiply": a * b}

class HelloSchema(Schema):
    name:str ="42"

@api.post("/hello")
def hello_post(request, data: HelloSchema):
    return f"Hello {data.name}"

class UserSchema(Schema):
    username: str
    is_authenticated: bool
    # Unauthenticated users don't have the following fields, so provide defaults.
    email: str | None = None
    first_name: str |None = None
    last_name: str  |None= None

class Error(Schema):
    message: str

@api.get("/me", response={200: UserSchema, 403: Error})
def me(request: HttpRequest):
  if not request.user.is_authenticated:
    return 403, {"message": "Please sign in"}
  return request.user
