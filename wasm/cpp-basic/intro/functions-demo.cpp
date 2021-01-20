#include <iostream>
#include <string>
using namespace std;

void odd(int x);
void even(int);
// type name(parameter1, parameter2, ...) { statements }

int addition(int a, int b)
{
  int r;
  r = a + b;
  return r;
}

int subtraction(int a, int b)
{
  int r = a - b;
  return r;
}

void printmsg(const string &str)
{
  cout << str;
}

void duplicate(int &a, int &b, int &c)
{
  a *= 2;
  b *= 2;
  c *= 2;
}

string concatenate(string &a, const string &b)
{
  a = a + b;
  return a;
}

string concatenateStatic(const string &a, const string &b)
{
  return a + b;
}

inline string concatenateInline(const string &a, const string &b)
{
  return a + b;
}

int divide(int a, int b = 2)
{
  int r;
  r = a / b;
  return r;
}

int main()
{
  int z;
  z = addition(5, 3);
  cout << "The result is " << z << endl;
  printmsg("Hello\n");

  int x = 5, y = 3;
  z = subtraction(7, 2);
  cout << "The first result is " << z << endl;
  cout << "The second result is " << subtraction(7, 2) << endl;
  cout << "The third result is " << subtraction(x, y) << endl;
  z = 4 + subtraction(x, y);
  cout << "The fourth result is " << z << endl;

  int s = 1, t = 3, u = 7;
  duplicate(s, t, u);
  cout << "s=" << s << ", t=" << t << ", u=" << u << endl;

  string d = "8b09ao98", e = "asontuehs";
  string f = concatenateStatic(d, e);
  cout << "f: " << f << endl;
  cout << "d: " << d << endl;
  cout << "e: " << e << endl;

  string g = concatenate(d, e);
  cout << "g: " << g << endl;
  cout << "d: " << d << endl;
  cout << "e: " << e << endl;

  cout << "divide(12) = " << divide(12) << endl;
  cout << "divide(20, 4) = " << divide(20, 4) << endl;

  int i = 10;
  do
  {
    odd(i);
  } while (i--);

  return 0;
}

void odd(int x)
{
  if ((x % 2) != 0)
    cout << x << " is odd.\n";
  else
    even(x);
}

void even(int x)
{
  if ((x % 2) == 0)
    cout << x << " is even.\n";
  else
    odd(x);
}

/**
 * Function Overloading
 * Two different functions can have the same name if their parameters are different; either because they have a different number of parameters, or because any of their parameters are of a different type
 *
 * Note that a function cannot be overloaded only by its return type. At least one of its parameters must have a different type.
 *  */

int operate(int a, int b)
{
  return (a * b);
}

double operate(double a, double b)
{
  return (a / b);
}
