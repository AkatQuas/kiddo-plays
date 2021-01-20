#include <iostream>
// Allow us to Define the Array or list of objects at run time
#include <vector>

#include <set>

#include <map>

#include <tuple>

using namespace std;

void usingVector()
{
  string val;
  vector<string> my_vector; // initialize the vector

  cin >> val;

  // will push the value of 'val' into vector ("array") my_vector
  my_vector.push_back(val);

  // will push the value into the vector again (now having two elements)
  my_vector.push_back(val);

  for (int i = 0; i < my_vector.size(); i++)
  {
    // for accessing a vector's element we can use the operator []
    cout << my_vector[i] << endl;
  }

  // or using an iterator:
  vector<string>::iterator it;
  for (it = my_vector.begin(); it != my_vector.end(); ++it)
  {
    cout << *it << endl;
  }
}

// Set
// Sets are containers that store unique elements following a specific order.
// Set is a very useful container to store unique values in sorted order
// without any other functions or code.

void usingSet()
{
  set<int> ST;
  ST.insert(30);
  ST.insert(20);
  ST.insert(10);
  ST.insert(30);

  ST.erase(20);

  set<int>::iterator it;
  for (it = ST.begin(); it != ST.end(); it++)
  {
    cout << *it << endl;
  }

  ST.clear();

  cout << ST.size();
  // NOTE: for duplicate elements we can use multiset

  // NOTE: For hash sets, use unordered_set. They are more efficient but
  // do not preserve order. unordered_set is available since C++11
}

void usingMap()
{
  map<char, int> mymap;

  mymap.insert(pair<char, int>('A', 1));

  mymap.insert(pair<char, int>('Z', 26));

  map<char, int>::iterator it;
  for (it = mymap.begin(); it != mymap.end(); ++it)
  {
    std::cout << it->first << "->" << it->second << '\n';
  }
  // Output:
  // A->1
  // Z->26

  // To find the value corresponding to a key
  it = mymap.find('Z');
  cout << it->second;

  // NOTE: For hash maps, use unordered_map. They are more efficient but do
  // not preserve order. unordered_map is available since C++11.
}

void usingTuple()
{
  // Conceptually, Tuples are similar to  old data structures (C-like structs) but instead of having named data members,
  // its elements are accessed by their order in the tuple.

  auto first = make_tuple(10, 'A');
  const int maxN = 1e9;
  const int maxL = 15;
  auto second = make_tuple(maxN, maxL);

  cout << get<0>(first) << " " << get<1>(first) << "\n";
  cout << get<0>(second) << " " << get<1>(second) << "\n";

  int first_int;
  char first_char;
  tie(first_int, first_char) = first;
  cout << first_int << " " << first_char << "\n";

  tuple<int, char, double> third(11, 'A', 3.141);

  cout << tuple_size<decltype(third)>::value << "\n";

  // tuple_cat concatenates the elements of all the tuples in the same order.

  auto concatenated_tuple = tuple_cat(first, second, third);
  // concatenated_tuple becomes = (10, 'A', 1e9, 15, 11, 'A', 3.14141)
  cout << "concated ->" << get<0>(concatenated_tuple) << "\n"; // prints: 10
  cout << "concated ->" << get<3>(concatenated_tuple) << "\n"; // prints: 15
  cout << "concated ->" << get<5>(concatenated_tuple) << "\n"; // prints: 'A'
}

int main()
{

  usingTuple();
  return 0;
}
