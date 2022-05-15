#include <node.h>
#include "myobject.h"

namespace demo
{
  void Init(v8::Local<v8::Object> exports)
  {
    MyObject::Init(exports);
  }
  NODE_MODULE(NODE_GYP_MODULE_NAME, Init)
} // namespace demo
