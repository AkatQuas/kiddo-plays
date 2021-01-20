#include <iostream>
#include <new>

using namespace std;

/**
 * Dynamic memory is allocated using operator `new`.
 * `new` is followed by a data type specifier and, if a sequence of more than one element is required, the number of these within brackets [].
 *
 * It returns a pointer to the beginning of the new block of memory allocated.
 */

/**
 * In most cases, memory allocated dynamically is only needed
 * during specific periods of time within a program; once it is no longer needed,
 * it can be freed so that the memory becomes available again for other requests of dynamic memory.
 */

void remember()
{
  int i, n;
  int *p;
  cout << "How many numbers would you like to type? ";
  cin >> i;
  p = new (nothrow) int[i];
  if (p == nullptr)
  {
    cout << "Error: memory could not be allocated";
  }
  else
  {
    for (n = 0; n < i; n++)
    {
      cout << "Enter number: ";
      cin >> p[n];
    }
    cout << "You have entered: ";
    for (n = 0; n < i; n++)
      cout << p[n] << ", ";
    delete[] p;
  }
}

int main()
{
  int *foo;
  // no exception will thrown if allocation fails
  foo = new (nothrow) int[5];
  if (foo == nullptr)
  {
    // error assigning memory. Take measures.
  }
  else
  {

    // successfully assigning memory. Take measures.
    delete foo;
  }

  return 0;
}
