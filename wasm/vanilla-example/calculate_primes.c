#include <stdlib.h>
#include <stdio.h>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

int IsPrime(int value)
{
  if (value == 2)
  {
    return 1;
  }

  if (value <= 1 || value % 2 == 0)
  {
    return 0;
  }

  for (int i = 3; (i * i) <= value; i += 2)
  {
    if (value % i == 0)
    {
      return 0;
    }
  }

  return 1;
}

/*
When Emscripten sees a main function in your C or C++ code,
it will specify this function as the start function for the module.

Once the module has been downloaded and compiled,
the WebAssembly framework will call the start function automatically.
 */
int main()
{
  int start = 3;
  int end = 10000;
  printf("Prime numbers between %d and %d:\n", start, end);

  for (int i = start; i < end; i += 2)
  {
    if (IsPrime(i))
    {
      printf("%d ", i);
    }
  }
  printf("\n");

  return 0;
}
