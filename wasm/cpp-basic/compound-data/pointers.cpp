#include <iostream>

using namespace std;

void pointer1()
{
  int firstvalue, secondvalue;
  int *mypointer;

  mypointer = &firstvalue;
  *mypointer = 110;
  mypointer = &secondvalue;
  *mypointer = 120;
  cout << "firstvalue is " << firstvalue << '\n';
  cout << "secondvalue is " << secondvalue << '\n';
}

void pointer2()
{
  int firstvalue = 5, secondvalue = 15;
  int *p1, *p2;

  p1 = &firstvalue;  // p1 = address of firstvalue
  p2 = &secondvalue; // p2 = address of secondvalue
  *p1 = 210;         // value pointed to by p1 = 10
  *p2 = *p1;         // value pointed to by p2 = value pointed to by p1
  p1 = p2;           // p1 = p2 (value of pointer is copied)
  *p1 = 220;         // value pointed to by p1 = 20

  cout << "firstvalue is " << firstvalue << '\n';
  cout << "secondvalue is " << secondvalue << '\n';
}

/**
 *
 * The concept of arrays is related to that of pointers.
 * In fact, arrays work very much like pointers to their first elements,
 * and, actually, an array can always be implicitly converted to the pointer of the proper type.
 */

void array2pointer()
{
  int numbers[7];
  int *p;

  p = numbers;
  *p = 10;

  p++;
  *p = 20;

  p = &numbers[2];
  *p = 30;

  p = numbers + 3;
  *p = 40;

  p = numbers;
  *(p + 4) = 50;

  numbers[5] = 60;

  *(numbers + 6) = 70;

  for (int i = 0; i < 7; i++)
  {
    cout << numbers[i] << ", ";
  }
}

void increment_all(int *start, int *stop)
{
  int *current = start;
  while (current != stop)
  {
    ++(*current); // increment value pointed
    ++current;    // increment pointer
  }
}

void print_all(const int *start, const int *stop)
{
  const int *current = start;
  while (current != stop)
  {
    cout << *current << '\n';
    ++current; // increment pointer
  }
}

/**
 * void represents the absence of type.
 * void pointers that point to a value that has no type.
 */
void increase(void *data, int psize)
{
  if (psize == sizeof(char))
  {
    char *pchar;
    pchar = (char *)data;
    ++(*pchar);
  }
  else if (psize == sizeof(int))
  {
    int *pint;
    pint = (int *)data;
    ++(*pint);
  }
}

int addition(int a, int b)
{
  return (a + b);
}

int subtraction(int a, int b)
{
  return (a - b);
}

int operation(int x, int y, int (*functocall)(int, int))
{
  int g;
  g = (*functocall)(x, y);
  return (g);
}

int main()
{
  pointer1();
  pointer2();
  array2pointer();

  int x;
  int y = 10;
  const int *p = &y;
  x = *p; // ok: reading p
  // *p = x; // error: modifying p, which is const-qualified

  cout << '\n';
  int numbers[] = {10, 20, 30};
  increment_all(numbers, numbers + 3);
  print_all(numbers, numbers + 3);

  char a = 'x';
  int b = 1062;
  cout << "before increase: " << a << ", " << b << '\n';
  increase(&a, sizeof(a));
  increase(&b, sizeof(b));
  cout << "after increase: " << a << ", " << b << '\n';

  int *pnull = 0;
  int *qnull = nullptr;

  int m, n;
  int (*minus)(int, int) = subtraction;
  m = operation(7, 5, addition);
  n = operation(20, m, minus);
  cout << n;

  return 0;
}
