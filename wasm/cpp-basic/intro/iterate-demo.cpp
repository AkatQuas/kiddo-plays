#include <iostream>

using namespace std;

void plainIterate()
{
  int arr[] = {1, 10, 3};

  for (int el : arr)
  {
    cout << el << endl;
  }

  // You can use "auto" and not worry about the type of the elements of the container
  // For example:
  for (auto elem : arr)
  {
    cout << elem << " index" << endl;
  }
}

int main()
{
  cout << "Hello World";
  plainIterate();
  return 0;
}
