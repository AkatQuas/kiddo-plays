#include "myobject.h"

namespace demo
{
  using v8::Context;
  using v8::Function;
  using v8::FunctionCallbackInfo;
  using v8::FunctionTemplate;
  using v8::Isolate;
  using v8::Local;
  using v8::Number;
  using v8::Object;
  using v8::ObjectTemplate;
  using v8::String;
  using v8::Value;

  MyObject::MyObject(double value) : value_(value) {}

  MyObject::~MyObject() {}

  void MyObject::Init(Local<Object> exports)
  {
    Isolate *isolate = exports->GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();

    Local<ObjectTemplate> addon_data_tpl = ObjectTemplate::New(isolate);
    addon_data_tpl->SetInternalFieldCount(1); // 1 field for the MyObject::New()
    Local<Object> addon_data = addon_data_tpl->NewInstance(context).ToLocalChecked();
    // AT "2022/04/04 22:45"
    // TODO CONTINUE
    // https://nodejs.org/api/addons.html#addon-examples
  }

  void MyObject::New(const FunctionCallbackInfo<Value> &args) {}

  void MyObject::PlusOne(const FunctionCallbackInfo<Value> &args)
  {
    Isolate *isolate = args.GetIsolate();
    MyObject *obj = ObjectWrap::Unwrap<MyObject>(args.Holder());
    obj->value_ += 1;
    args.GetReturnValue().Set(Number::New(isolate, obj->value_));
  }

} // namespace demo
