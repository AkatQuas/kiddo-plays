#include <iostream>
#include <string>
#include <sstream>

#define PI 3.14159
#define NEWLINE '\n'

using namespace std;

void variables()
{
  int a;
  float num;

  char b, c, d;

  // c-like initialization
  // type identifier = initial_value;
  int x = 0;

  // constructor initialization
  // type identifier (initial_value);
  int y(0);

  // uniform initialization
  // type identifier { initial_value };
  int z{0};

  // `t` has the same type as `x`, and initial_value the same as `x`;
  auto t = x;

  // `s` has the same type as `t`, but no initial_value;
  decltype(t) s;
}

void usingString()
{
  // #include <string> to make it works
  string mystring = "This is a string";
  string mystring2("This is a string");
  string mystring3{"This is a string"};
  cout << mystring;
  cout << mystring2 << endl;
  cout << mystring3 << endl;
}

void usingContants()
{

  /**
   * Literal constants can be classified into: integer, floating-point, characters, strings, Boolean, pointers, and user-defined literals.

    75         // decimal
    0113       // octal
    0x4b       // hexadecimal

    75         // int
    75u        // unsigned int
    75l        // long
    75ul       // unsigned long
    75lu       // unsigned long

    3.14159L   // long double
    6.02e23f   // float

    'z'
    'p'
    "Hello world"
    "How do you do?"

    '\n'
    '\t'
    "Left \t Right"
    "one\ntwo\nthree"
    "string expressed in \
    two lines"

    R"(string with \backslash)"
    R"&%$(string with \backslash)&%$"

  */

  bool foo = true;  // bool
  bool bar = false; // bool
  int *p = nullptr; // null pointer value
}

void usingInputAndOutput()
{

  int b;
  cout << "Enter a number you like:\n";
  cin >> b;
  clog << "this is log";
  cerr << "Put some error log";

  string mystring;
  cout << "What's your name?\n";
  getline(cin, mystring);
  cout << "Hello " << mystring << ".\n";
  cout << "What's your favorite team? \n";
  getline(cin, mystring);
  cout << "You like " << mystring << ". Haha!\n";

  string mystr("1024");
  int myint;
  stringstream(mystr) >> myint;
  cout << myint;
}

int main()
{
  std::cout << "Hello world!";

  std::cout << "I'm a C++ program";

  cout << "I skip the namespace";

  return 0;
}
