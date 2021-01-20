#include <iostream>

using namespace std;

// typedef existing_type alias_type_name;

typedef char C;
typedef unsigned int WORD;
typedef char *pChar;
typedef char field[50];

// using alias_type_name = existing_type;

/**
 * They are semantically equivalent.
 * The only difference being that `typedef` has certain limitations in the realm of templates that `using` has not.
 * Therefore, `using` is more generic, although `typedef` has a longer history and is probably more common in existing code.
 */

using C2 = char;
using WORD2 = unsigned int;
using pChar2 = char *;
using field2 = char[50];

/*
  union type_name {
    member_type1 member_name1;
    member_type2 member_name2;
    member_type3 member_name3;
    .
    .
  } object_names;
 */

/**
 * Unions allow one portion of memory to
 * be accessed as different data types.
 *
 * Each of these members is of a different data type.
 * But since all of them are referring to the same location in memory,
 * the modification of one of the members will affect the value of all of them.
 */

union onetypes_t
{
  char c;
  int i;
  float f;
} onetypes;

// int has the size of 4 bytes
// short of 2 bytes
// char of 1 bytes
union mix_t
{
  int l;
  struct
  {
    short hi;
    short lo;
  } s;
  char c[4];
} mix;

// nested named unions
struct book1_t
{
  char title[50];
  char author[50];
  union
  {
    float dollars;
    int yen;
  } price;
} book1;

// book1.price.dollars;
// book1.price.yen;

// nested anonymous unions
struct book2_t
{
  char title[50];
  char author[50];
  union
  {
    float dollars;
    int yen;
  };
} book2;

// book2.dollars;
// book2.yen;

/*

  enum type_name {
    value1,
    value2,
    value3,
    .
    .
  } object_names;

 */
enum colors_t
{
  black /* = 0 */,
  blue /* = 1 */,
  green /* = 2 */,
  cyan /* = 3 */,
  red /* = 4 */,
  purple /* = 5 */,
  yellow /* = 6 */,
  white /* = 7 */
};

enum months_t
{
  january = 1,
  february /* = 2 */,
  march,
  april,
  may,
  june,
  july,
  august,
  september,
  october,
  november,
  december /* = 12 */
} y2k;

enum class Colors
{
  black,
  blue,
  green,
  cyan,
  red,
  purple,
  yellow,
  white
};

// underlying type could be `char`, `unsigned int`, `short`
enum class EyeColor : char
{
  blue,
  green,
  brown
};

int main()
{
  colors_t mycolor;
  mycolor = blue;
  if (mycolor == green)
  {
    mycolor = red;
  }

  Colors mycolor2;
  mycolor2 = Colors::black;

  if (mycolor2 == Colors::green)
  {
    mycolor2 = Colors::red;
  }

  return 0;
}
