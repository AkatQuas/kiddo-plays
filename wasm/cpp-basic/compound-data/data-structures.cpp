#include <iostream>

using namespace std;

/**
 * A data structure is a group of data elements grouped together under one name.
 * These data elements, known as members.
 */

/*

struct type_name {
member_type1 member_name1;
member_type2 member_name2;
member_type3 member_name3;
.
.
} object_names;

*/

struct product
{
  int weight;
  double price;
};

struct movies_t
{
  string title;
  int year;
};

void printmovie(movies_t movie);

int main()
{
  product apple;
  product banana;
  product melon;

  string mystr;
  int n;

  movies_t mine, yours;
  mine.title = "2001 A Space Odyssey";
  mine.year = 1968;

  std::cout << "Enter title: ";
  std::getline(cin, yours.title);
  std::cout << "Enter year: ";
  std::getline(cin, mystr);
  stringstream(mystr) >> yours.year;

  std::cout << "My favorite movie is: \n";
  printmovie(mine);

  std::cout << "And yours is: \n";
  printmovie(yours);

  movies_t films[3];

  for (n = 0; n < 3; n++)
  {
    std::cout << "Enter title: ";
    std::getline(cin, films[n].title);
    std::cout << "Enter year: ";
    std::getline(cin, mystr);
    stringstream(mystr) >> films[n].year;
  }

  std::cout << "\nYou have entered these movies:\n";
  for (n = 0; n < 3; n++)
  {
    printmovie(films[n]);
  }

  movies_t *pmine;
  pmine = &mine;
  std::cout << "\nUsing pointer ptr->member :\n";
  std::cout << pmine->title;
  std::cout << " (" << pmine->year << ")\n";

  std::cout << "\nUsing pointer (*ptr).member :\n";
  std::cout << (*pmine).title;
  std::cout << " (" << (*pmine).year << ")\n";

  return 0;
}

void printmovie(movies_t movie)
{
  std::cout << movie.title;
  std::cout << " (" << movie.year << ")\n";
}
