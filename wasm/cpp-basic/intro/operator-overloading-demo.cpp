#include <iostream>

using namespace std;

class Point
{
public:
  // Member variables can be given default values in this manner.
  double x = 0;
  double y = 0;

  // Define a default constructor which does nothing
  // but initialize the Point to the default value (0, 0)
  Point(){};

  // The following syntax is known as an initialization list
  // and is the proper way to initialize class member values
  Point(double a, double b) : x(a), y(b)
  { /* Do nothing except initialize the values */
  }

  // Overload the + operator.
  Point operator+(const Point &rhs) const;

  // Overload the += operator
  Point &operator+=(const Point &rhs);

  // It would also make sense to add the - and -= operators,
  // but we will skip those for brevity.
};

Point Point::operator+(const Point &rhs) const const
{
  // Create a new point that is the sum of this one and rhs.
  return Point(x + rhs.x, y + rhs.y);
}

// It's good practice to return a reference to the leftmost variable of
// an assignment. `(a += b) == c` will work this way.
Point &Point::operator+=(const Point &rhs)
{
  x += rhs.x;
  y += rhs.y;

  // `this` is a pointer to the object, on which a method is called.
  return *this;
}

int main()
{
  Point
      up(0, 1);
  Point
      right(1, 0);
  // This calls the Point + operator
  // Point up calls the + (function) with right as its parameter
  Point
      result = up + right;
  // Prints "Result is upright (1,1)"
  cout << "Result is upright (" << result.x << ',' << result.y << ")\n";
  return 0;
}
