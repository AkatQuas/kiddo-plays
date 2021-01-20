#include <iostream>
#include <array>

using namespace std;

void printarray(int arg[], int length)
{
  for (int n = 0; n < length; ++n)
  {
    cout << arg[n] << ' ';
  }
  cout << '\n';
}
/**
 * An array is a series of elements of the same type placed in contiguous memory locations that can be individually referenced by adding an index to a unique identifier.
 *
 * A typical declaration for an array in C++ is:
 * `type name [elements];`
 *
 */
int main()
{

  int arr1[5];
  int arr2[5] = {15, 2, 88, 40, 2091};
  int arr3[5] = {38, 20, 1091};
  int arr4[5] = {};
  for (int i = 0; i < 5; i++)
  {
    cout << "arr1[" << i << "] is " << arr1[i] << endl;
    cout << "arr2[" << i << "] is " << arr2[i] << endl;
    cout << "arr3[" << i << "] is " << arr3[i] << endl;
    cout << "arr4[" << i << "] is " << arr4[i] << endl;
  }

  int firstarray[] = {5, 10, 15};
  int secondarray[] = {2, 4, 5, 8, 10};
  printarray(firstarray, 3);
  printarray(secondarray, 4);

  array<int, 3> myarray{10, 20, 30};

  for (int i = 0; i < myarray.size(); ++i)
  {
    ++myarray[i];
  }
  for (int elem : myarray)
  {
    cout << elem << '\n';
  }

  return 0;
}
