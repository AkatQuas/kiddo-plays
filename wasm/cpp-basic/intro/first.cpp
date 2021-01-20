#include <iostream>

using namespace std;

void print(char const *myString)
{
  printf("String %s\n", myString);
}

void print(int myInt)
{
  printf("My int is %d", myInt);
}

void doSomethingWithInts(int a = 1, int b = 4)
{
  printf("\na = %d, b = %d.\n", a, b);
}

namespace First
{
  namespace Nested
  {
    void foo()
    {
      printf("This is First::Nested::foo\n");
    }
  } // namespace Nested
} // namespace First

namespace Second
{
  void foo()
  {
    printf("This is Second::foo\n");
  }
} // namespace Second

void ioDemo()
{
  int myInt;
  cerr << "Used for error message\n";

  cout << "Enter your favorite number: \n";
  cin >> myInt;
  cout << "Your favorite number is " << myInt << "\n";

  cout << "Hello World";
  print("hello");
  print(15);
  doSomethingWithInts(2, 3);
  doSomethingWithInts(1);
  doSomethingWithInts(8, 5);
  First::Nested::foo();
  Second::foo();
}

void stringDemo()
{
  string myString = "Hello";
  string myOtherString = " World";
  cout << myString + myOtherString;
  cout << myString + " You";
  cout << (myString.append(" DOg"));
}

void divideln()
{
  cout << "---\n";
}

void stringPointerDemo()
{
  string foo = " I am foo";
  string bar = " I am bar";
  string &fooRef = foo;
  string fooString = foo;
  fooRef += ". Hi!\n";
  cout << fooString << "\n";
  cout << foo;
  cout << fooRef;

  divideln();
  cout << &fooRef << endl;
  divideln();
  cout << endl;
  divideln();

  const string &barRef = bar;
  bar += " .Hi!";
  cout << barRef;
}

enum ECarTypes
{
  Sedan,
  Hatchback = 3,
  SUV,
  Wagon
};

ECarTypes
GetPreferredCarType()
{
  return ECarTypes::Wagon;
}

void printPreferredCar()
{
  cout << (GetPreferredCarType());
}

namespace KlassAndInheritance
{
  // Declare a class.
  // Classes are usually declared in header (.h or .hpp) files.
  class Dog
  {
    // Member variables and functions are private by default.
    std::string name;
    int weight;

    // All members following this are public
    // until "private:" or "protected:" is found.
  public:
    // Default constructor
    Dog();

    // Member function declarations (implementations to follow)
    // Note that we use std::string here instead of placing
    // using namespace std;
    // above.
    // Never put a "using namespace" statement in a header.
    void setName(const std::string &dogsName);

    void setWeight(int dogsWeight);

    // Functions that do not modify the state of the object
    // should be marked as const.
    // This allows you to call them if given a const reference to the object.
    // Also note the functions must be explicitly declared as _virtual_
    // in order to be overridden in derived classes.
    // Functions are not virtual by default for performance reasons.
    virtual void print() const;

    // Functions can also be defined inside the class body.
    // Functions defined as such are automatically inlined.
    void bark() const
    {
      std::cout << name << " barks!\n";
    }

    // Along with constructors, C++ provides destructors.
    // These are called when an object is deleted or falls out of scope.
    // This enables powerful paradigms such as RAII
    // (see below)
    // The destructor should be virtual if a class is to be derived from;
    // if it is not virtual, then the derived class' destructor will
    // not be called if the object is destroyed through a base-class reference
    // or pointer.
    virtual ~Dog();
  }; // A semicolon must follow the class definition.

  // Class member functions are usually implemented in .cpp files.
  Dog::Dog()
  {
  std:
    cout << "A dog has been constructed\n";
  }

  // Objects (such as strings) should be passed by reference
  // if you are modifying them or const reference if you are not.
  void Dog::setName(const std::string &dogsName)
  {
    name = dogsName;
  }

  void Dog::setWeight(int dogsWeight)
  {
    weight = dogsWeight;
  }

  // Notice tha "virtual" is only needed in the declaration, not the implementation.
  void Dog::print() const
  {
    std::cout << "Dog is " << name << " and weights " << weight << "kg\n";
  }

  Dog::~Dog()
  {
    std::cout << "Goodbye " << name << " \n";
  }

  // Inheritance:

  // This class inherits everything public and protected from the Dog class
  // as well ass private but may not directly access private members/methods
  // without a public or protected method for doing should
  class OwnedDog : public Dog
  {
  public:
    void setOwner(const std::string &dogsOwner);

    // Override the behavior of the print function for all OwnedDogs. See
    // http://en.wikipedia.org/wiki/Polymorphism_(computer_science)#Subtyping
    // for a more general introduction if you are unfamiliar with
    // subtype polymorphism.
    // The override keyword is optional but makes sure you are actually
    // overriding the method in a base class.
    void print() const override;

  private:
    std::string owner;
  };

  void OwnedDog::setOwner(const std::string &dogsOwner)
  {
    owner = dogsOwner;
  }

  void OwnedDog::print() const
  {
    Dog::print(); // Call the print function in the base Dog class
    std::cout << "Dog is owned by " << owner << "\n";
  }

  void playWithDog()
  {
    Dog myDog;
    myDog.setName("Michael");
    myDog.setWeight(13);
    myDog.print();
    OwnedDog oDog;
    oDog.setName("Michael Bai");
    oDog.setWeight(14);
    oDog.setOwner("DoubleT");
    oDog.print();
  }
} // namespace KlassAndInheritance

int main()
{
  KlassAndInheritance::playWithDog();
  return 0;
}
