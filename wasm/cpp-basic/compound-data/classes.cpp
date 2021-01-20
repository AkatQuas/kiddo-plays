#include <iostream>

using namespace std;

/**
 * Classes are an expanded concept of data structures: like data structures,
 * they can contain data members, but they can also contain functions as members.
 */

/*

class class_name {
  access_specifier_1: member1;
  access_specifier_2: member2;
...
} object_names;

*/

class Square;

class Rectangle
{
  // default access_specifier is private
  int width, height;

public:
  Rectangle();
  // constructor function
  Rectangle(int, int);
  void set_values(int, int);
  int area(void);
  // this will be an inline member function
  int area2() { return width * height; };
  friend Rectangle doublesize(const Rectangle &);
  void convert(Square a);
};

// overloading constructors
Rectangle::Rectangle()
{
  width = 5;
  height = 5;
}

// no return type
// not even void
// simple initialize the object
Rectangle::Rectangle(int a, int b)
{
  width = a;
  height = b * 2;
}

// member initialization
// Rectangle::Rectangle(int a, int b) : width(a) { height = b;}
// Rectangle::Rectangle(int a, int b): width(a), height(b) {}

void Rectangle::set_values(int x, int y)
{
  width = x;
  height = y * 2;
}

void Rectangle::convert(Square a)
{
  width = a.side;
  height = a.side;
}

// this is a normal (not-inline) class member function
int Rectangle::area()
{
  return width * height;
}

Rectangle doublesize(const Rectangle &param)
{
  Rectangle res;
  res.width = param.width * 2;
  res.height = param.height * 2;
  return res;
}

class Square
{
  friend class Rectangle;

private:
  int side;

public:
  Square(int a) { side = a; }
  ~Square() {}
};

void printArea(const char *, Rectangle);

class Circle
{
  double radius;

public:
  Circle(double r) { radius = r; }
  double circum() { return 2 * radius * 3.1415926; }
  double area() { return radius * radius * 3.1415926; }
};

class Cylinder
{
private:
  Circle base;
  double height;

public:
  Cylinder(double r, double h) : base(r), height(h){};
  double volume() { return base.area() * height; }
  // ~Cylinder();
};

// Cylinder::Cylinder(double r, double h) { }

// Cylinder::~Cylinder() { }

int main()
{
  Rectangle rect(1, 2), rectb(1, 2);
  // default constructor called
  Rectangle rectc;

  // default constructor not called,
  // but given undefined arguments
  Rectangle rectd(/* width = void, heigt = void */);

  // default constructor called
  Rectangle recte{};

  Rectangle *rectptr, *rectbar, *rectbaz;

  rectptr = &rect;

  cout << "before set_values" << endl;
  printArea("rect pointer", *rectptr);
  cout << "rect pointer->area()" << rectptr->area() << endl;
  printArea("rect", rect);
  printArea("rectB", rectb);
  printArea("rectC", rectc);

  rect.set_values(3, 4);
  rectb.set_values(5, 6);
  rectc.set_values(10, 10);
  cout << "after set_values" << endl;
  printArea("rect pointer", *rectptr);
  cout << "rect pointer->area()" << rectptr->area() << endl;
  printArea("rect", rect);
  printArea("rectB", rectb);
  printArea("rectC", rectc);

  rectbar = new Rectangle(5, 6);
  rectbaz = new Rectangle[2]{{2, 5}, {3, 6}};
  cout << "*rectbar's area using '->area()': " << rectbar->area() << '\n';
  cout << "*rectbaz[0]'s area using '->area()': " << rectbaz[0].area() << '\n';
  cout << "*rectbaz[1]'s area using '->area()': " << rectbaz[1].area() << '\n';

  delete rectbar;
  delete[] rectbaz;

  Circle foo(10.0);    // functional form
  Circle bar = 20;     // assignment initialization
  Circle baz{30.0};    // uniform initializationn
  Circle qux = {40.0}; // POD-like

  Cylinder foc(10.5, 20.0);
  cout << "foo's volume: " << foc.volume() << '\n';
  return 0;
}

void printArea(const char *s, Rectangle rect)
{
  cout << s << ".area: " << rect.area() << endl;
  cout << s << ".area: " << rect.area2() << endl;
}

/*

Classes can be defined not only with keyword class, but also with keywords struct and union.

The keyword struct, generally used to declare plain data structures, can also be used to declare classes that have member functions, with the same syntax as with keyword class. The only difference between both is that members of classes declared with the keyword struct have public access by default, while members of classes declared with the keyword class have private access by default. For all other purposes both keywords are equivalent in this context.

Conversely, the concept of unions is different from that of classes declared with struct and class, since unions only store one data member at a time, but nevertheless they are also classes and can thus also hold member functions. The default access in union classes is public.

 */

/**
 * overload operators
 */
class CVector
{
public:
  int x, y;
  CVector(){};
  CVector(int a, int b) : x(a), y(b) {}
  CVector operator+(const CVector &);
};

CVector CVector::operator+(const CVector &param)
{
  CVector temp;
  temp.x = x + param.x;
  temp.y = y + param.y;
  return temp;
}

CVector operator-(const CVector &lhs, const CVector &rhs)
{
  CVector temp;
  temp.x = lhs.x - rhs.x;
  temp.y = lhs.y - rhs.y;
  return temp;
}

/**
 * Static members
 */
class Dummy
{
public:
  static int n;
  Dummy()
  {
    // n is the static member
    n++;
  };
};

int Dummy::n = 0;

class MyClass
{
public:
  int x;
  MyClass(int val) : x(val) {}
  int get() { return x; }
};

void modifyMyClass()
{
  const MyClass foo(10);
  // foo.x = 20;            // not valid: x cannot be modified
  cout << foo.x << '\n'; // ok: data member x can be read
}

template <typename T>
class myPair
{
private:
  T values[2];

public:
  myPair(T first, T second)
  {
    values[0] = first;
    values[1] = second;
  };
  T getmax();
};

template <class T>
T myPair<T>::getmax()
{
  T retval;
  retval = values[0] > values[1] ? values[0] : values[1];
  return retval;
}

template <typename T>
class myContainer
{
private:
  T element;

public:
  myContainer(T arg) { element = arg; };
  T increase() { return ++element; };
};

// class template sepcialization
// no template arguments required since all types are known
template <>
class myContainer<char>
{
  char element;

public:
  myContainer(char arg) { element = arg; };
  char uppercase()
  {
    if ((element >= 'a') && (element <= 'z'))
    {
      element += 'A' - 'a';
    }
    return element;
  }
};

void useMyContainer()
{
  myContainer<int> myint(7);
  myContainer<char> mychar('j');
  cout << myint.increase() << endl;
  cout << mychar.uppercase() << endl;
}

/*
special members

# default constructor
C::C();

# desctructor
C::~C();

# copy constructor
C::C (const C&);

# copy assignment
C& operator= (const C&);

# move constructor
C::C (C&&);

# move assignment
C& operator= (C&&);

 */

class Polygon
{
protected:
  int width, height;

public:
  Polygon(int a, int b) : width(a), height(b) {}
  void set_values(int a, int b)
  {
    width = a;
    height = b;
  }
  // virtual member is a member function
  // that can be redefined in a derived class,
  // while preserving its calling properties through references.
  virtual int area() { return 0; };
};

class Output
{
public:
  static void print(int i);
};

void Output::print(int i)
{
  cout << i << '\n';
}

class Rectangle2 : public Polygon, public Output
{
public:
  Rectangle2(int a, int b) : Polygon(a, b) {}
  int area() { return width * height; }
};

class Triangle : public Polygon, public Output
{
public:
  Triangle(int a, int b) : Polygon(a, b) {}
  int area() { return width * height / 2; }
};

void useInheritance()
{
  Rectangle2 rect{4, 5};
  Triangle trgl(4, 5);
  rect.print(rect.area());
  Triangle::print(trgl.area());
}

void usePolymorphism()
{
  Rectangle2 rect{4, 5};
  Triangle trgl(4, 5);
  Polygon *ppoly1 = &rect;
  Polygon *ppoly2 = &trgl;
  ppoly1->set_values(10, 50);
  ppoly2->set_values(5, 6);
  cout << ppoly2->area() << '\n';
}
