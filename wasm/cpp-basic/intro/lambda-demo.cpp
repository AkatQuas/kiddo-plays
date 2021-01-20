#include <iostream>
#include <vector>
#include <map>
#include <algorithm>

using namespace std;

///////////////////////////////////////
// Lambda Expressions (C++11 and above)
///////////////////////////////////////

// lambdas are a convenient way of defining an anonymous function
// object right at the location where it is invoked or passed as
// an argument to a function.

// For example, consider sorting a vector of pairs using the second
// value of the pair

void testLambda()
{
  vector<pair<int, int>> tester;
  tester.push_back(make_pair(3, 6));
  tester.push_back(make_pair(1, 9));
  tester.push_back(make_pair(5, 0));

  // Pass a lambda expression as third argument to the sort function
  // sort is from the <algorithm> header
  sort(tester.begin(), tester.end(),
       [](const pair<int, int> &lhs, const pair<int, int> &rhs) {
         return lhs.second < rhs.second;
       });
  // Notice the syntax of the lambda expression,
  // [] in the lambda is used to "capture" variables
  // The "Capture List" defines what from the outside of the lambda should be available inside the function body and how.
  // It can be either:
  //     1. a value : [x]
  //     2. a reference : [&x]
  //     3. any variable currently in scope by reference [&]
  //     4. same as 3, but by value [=]
}

void testLambda2()
{
  vector<int> dog_ids;
  for (int i = 0; i < 3; i++)
  {
    dog_ids.push_back(i);
  }

  int weight[3] = {30, 50, 10};
  // Say you want to sort dog_ids according to the dogs' weights
  // So dog_ids should in the end become: [2, 0, 1]

  // Here's where lambda expressions come in handy

  sort(dog_ids.begin(), dog_ids.end(),
       [&weight](const int &lhs, const int &rhs) {
         return weight[lhs] < weight[rhs];
       });
  // Note we captured "weight" by reference in the above example.
  // More on Lambdas in C++ : http://stackoverflow.com/questions/7627098/what-is-a-lambda-expression-in-c11
}

int main()
{
  cout << "Hello World";

  return 0;
}
