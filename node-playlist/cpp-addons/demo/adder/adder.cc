#include <node.h>

namespace demo
{
  using v8::Exception;
  using v8::FunctionCallbackInfo;
  using v8::Isolate;
  using v8::Local;
  using v8::Number;
  using v8::Object;
  using v8::String;
  using v8::Value;

  // This is the real implementation of the "add" method,
  // Input arguments are passed using the
  // const `FunctionCallbackInfo<Value>& args` struct
  void Add(const FunctionCallbackInfo<Value> &args)
  {
    Isolate *isolate = args.GetIsolate();

    // check the numbers of arguments passed.
    if (args.Length() != 2)
    {
      isolate->ThrowException(Exception::TypeError(
          String::NewFromUtf8(isolate,
                              "Expect only 2 arguments")
              .ToLocalChecked()));
      return;
    }

    // Check the argument type
    if (!args[0]->IsNumber() || !args[1]->IsNumber())
    {
      isolate->ThrowException(Exception::TypeError(
          String::NewFromUtf8(isolate,
                              "Both arguments should be number.")
              .ToLocalChecked()));
      return;
    }

    double value = args[0].As<Number>()->Value() + args[1].As<Number>()->Value();
    Local<Number> num = Number::New(isolate, value);

    // Set the return value (using the passed in
    // FunctionCallbackInfo<Value>&)
    args.GetReturnValue().Set(num);
  }

  void Init(Local<Object> exports)
  {
    NODE_SET_METHOD(exports, "add", Add);
  }

  NODE_MODULE(NODE_GYP_MODULE_NAME, Init)
} // namespace demo
