#include <iostream>
#include <string>

using namespace std;

/**
 * string are sequences of characters.
 * they could be treated as plain arrays of elements of a character type.
 *
 */

int main()
{
  char myword[] = {'H',
                   'e',
                   'l',
                   'l',
                   'o',
                   '\0'};
  // char myword[] = "Hello";

  myword[0] = 'B';
  myword[1] = 'y';
  myword[2] = 'e';
  myword[3] = '\0';

  char question1[] = "What is your name? ";
  string question2 = "Where do you live? ";
  char answer1[80];
  string answer2;

  cout << question1;
  cin >> answer1;

  cout << question2;
  cin >> answer2;

  cout << "Hello, " << answer1;
  cout << " from " << answer2 << "!\n";

  char myntcs[] = "some text";
  string mystring = myntcs; // convert c-string to string
  cout << mystring;         // printed as a library string
  cout << mystring.c_str(); // printed as a c-string

  return 0;
}
