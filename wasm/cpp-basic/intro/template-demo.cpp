#include <iostream>

using namespace std;

// Templates in C++ are mostly used for generic programming, though they are
// much more powerful than generic constructs in other languages. They also
// support explicit and partial specialization and functional-style type
// classes; in fact, they are a Turing-complete functional language embedded
// in C++!

/* Function templates */
// template <template - parameters> function - declaration

int sum(int a, int b)
{
  return a + b;
}

double sum(double a, double b)
{
  return a + b;
}

// template <class SomeType>
// SomeType sumTemplate(SomeType a, SomeType b)
// {
//   return a + b;
// }

template <class T>
T sumTemplate(T a, T b)
{
  T result;
  result = a + b;
  return result;
}

template <class T, class U>
bool are_equal(T a, U b)
{
  return a == b;
}

template <class T, int N>
T fixed_multiply(T val)
{
  return val * N;
}

void callMultiply()
{
  cout << fixed_multiply<int, 2>(10) << endl;
  cout << fixed_multiply<int, 3>(10) << endl;
}

// We start with the kind of generic programming you might be familiar with. To
// define a class or function that takes a type parameter:
template <class T>
class Box
{
public:
  void insert(const T &)
  {
  }
};

// During compilation, the compiler actually generates copies of each template
// with parameters substituted, so the full definition of the class must be
// present at each invocation. This is why you will see template classes defined
// entirely in the header files.

void templateKlass()
{
  // To instantiate a template class on the stack:
  Box<int> intBox;
  intBox.insert(123);

  // You can, of course, nest templates:
  // Until C++11, you had to place a space between the two '>'s, otherwise '>>'
  // would be parsed as the right shift operator.
  Box<Box<int>> boxOfBox;
  boxOfBox.insert(intBox);
}

// Similarly, a template function:
template <class T>
void barkThreeTimes(const T &input)
{
  input.bark();
  input.bark();
  input.bark();
}

// Notice that nothing is specified about the type parameters here. The compiler
// will generate and then type-check every invocation of the template, so the
// above function works with any type 'T' that has a const 'bark' method!

// Template parameters don't have to be classes:
template <int Y>
void printMessage()
{
  cout << "Learn C++ in " << Y << " minutes!" << endl;
}

int main()
{
  templateKlass();
  printMessage<1>();

  int x = sumTemplate<int>(10, 20);
  double y = sumTemplate<double>(10.0, 3.0);

  return 0;
}
