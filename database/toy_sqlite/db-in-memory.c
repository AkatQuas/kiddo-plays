#include <errno.h>
#include <fcntl.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

/* --- definition --- */

typedef enum
{
  EXECUTE_SUCCESS,
  EXECUTE_DUPLICATE_KEY,
  EXECUTE_TABLE_FULL,
} ExecuteResult;

typedef enum
{
  META_COMMAND_SUCCESS,
  META_COMMAND_UNRECOGNIZED_COMMAND,
} MetaCommandResult;

typedef enum
{
  PREPARE_SUCCESS,
  PREPARE_NEGATIVE_ID,
  PREPARE_STRING_TOO_LONG,
  PREPARE_SYNTAX_ERROR,
  PREPARE_UNRECOGNIZED_STATEMENT,
} PrepareResult;

/**
 * Wrapper around the state
 * to store to interact with `getline()`.
 */
typedef struct
{
  char *buffer;
  size_t buffer_length;
  ssize_t input_length;
} InputBuffer;

typedef enum
{
  STATEMENT_INSERT,
  STATEMENT_SELECT
} StatementType;

#define COLUMN_USERNAME_SIZE 32
#define COLUMN_EMAIL_SIZE 255
typedef struct
{
  uint32_t id;
  char username[COLUMN_USERNAME_SIZE + 1];
  char email[COLUMN_EMAIL_SIZE + 1];
} Row;

typedef struct
{
  StatementType type;
  Row row_to_insert;
} Statement;

/**
 * the layout of a serialized row look like:
 *
  column    size (bytes)  offset
  id          4             0
  username    32            4
  email       255           36
  total       291
 */

#define size_of_attribute(Struct, Attribute) sizeof(((Struct *)0)->Attribute)

const uint32_t ID_SIZE = size_of_attribute(Row, id);
const uint32_t USERNAME_SIZE = size_of_attribute(Row, username);
const uint32_t EMAIL_SIZE = size_of_attribute(Row, email);
const uint32_t ID_OFFSET = 0;
const uint32_t USERNAME_OFFSET = ID_OFFSET + ID_SIZE;
const uint32_t EMAIL_OFFSET = USERNAME_OFFSET + USERNAME_SIZE;
const uint32_t ROW_SIZE = ID_SIZE + USERNAME_SIZE + EMAIL_SIZE;

// 4 kilobytes is the same size as a page used
// in the virtual memory systems of most computer architectures.
const uint32_t PAGE_SIZE = 4096;
// arbitrary limit of pages, set 1000 if you like
#define TABLE_MAX_PAGES 100
const uint32_t ROWS_PER_PAGE = PAGE_SIZE / ROW_SIZE;
const uint32_t TABLE_MAX_ROWS = ROWS_PER_PAGE * TABLE_MAX_PAGES;

/**
 * Table structure points to pages of rows
 * and keeps track of how many rows there are
 */
typedef struct
{
  uint32_t num_rows;
  void *pages[TABLE_MAX_PAGES];
} Table;

/* --- internal --- */

InputBuffer *new_input_buffer()
{
  InputBuffer *input_buffer = (InputBuffer *)malloc(sizeof(InputBuffer));

  input_buffer->buffer = NULL;
  input_buffer->buffer_length = 0;
  input_buffer->input_length = 0;
  return input_buffer;
}

/**
 * Read a line of input
 */
void read_input(InputBuffer *input_buffer)
{
  /**
   * ssize_t getline(
   *     char **lineptr,   <- a pointer to the buffer containing the read line
   *     size_t *n,        <- a pointer to save the size of allocated buffer.
   *     FILE *stream      <- the input stream to read from
   * ); <- return value is the number of bytes read, may be less than the size of the buffer.
   *
   */
  ssize_t bytes_read = getline(&(input_buffer->buffer), &(input_buffer->buffer_length), stdin);

  if (bytes_read <= 0)
  {
    printf("Error reading input\n");
    exit(EXIT_FAILURE);
  }

  // Ignore trailing newline
  input_buffer->input_length = bytes_read - 1;
  input_buffer->buffer[bytes_read - 1] = 0;
}

/**
 * free the instance of InputBuffer and its buffer element
 */
void close_input_buffer(InputBuffer *input_buffer)
{
  free(input_buffer->buffer);
  free(input_buffer);
}

Table *new_table()
{
  Table *table = malloc(sizeof(Table));
  table->num_rows = 0;
  for (uint32_t i = 0; i < TABLE_MAX_PAGES; i++)
  {
    table->pages[i] = NULL;
  }
  return table;
}

void free_table(Table *table)
{
  for (uint32_t i = 0; table->pages[i]; i++)
  {
    free(table->pages[i]);
  }
  free(table);
}

/**
 * Prints a prompt to user.
 * Do this before reading each line of input.
 */
void print_prompt()
{
  printf("db > ");
}

void print_row(Row *row)
{
  printf("(%d, %s, %s)\n", row->id, row->username, row->email);
}

/**
 * Convert to compact representation
 */
void serialize_row(Row *source, void *destination)
{
  memcpy(destination + ID_OFFSET, &(source->id), ID_SIZE);
  memcpy(destination + USERNAME_OFFSET, &(source->username), USERNAME_SIZE);
  memcpy(destination + EMAIL_OFFSET, &(source->email), EMAIL_SIZE);
}

/**
 * Convert from compact representation
 */
void deserialize_row(void *source, Row *destination)
{
  memcpy(&(destination->id), source + ID_OFFSET, ID_SIZE);
  memcpy(&(destination->username), source + USERNAME_OFFSET, USERNAME_SIZE);
  memcpy(&(destination->email), source + EMAIL_OFFSET, EMAIL_SIZE);
}

/**
 * row_slot figures out where to read/write in memory for a particular row
 *

                                                rpp = ROWS_PER_PAGE
                                                rn = row_num
                                                ..................
      page 1              page 2                   page rn/rpp                   page k
  ┌───────────────┐   ┌───────────────┐      ┌───┬───────────────┐           ┌───────────────┐
  │               │   │               │      │   │               │           │               │
  │   row 1       │   │   row n+1     │   offset │   row n+1     │           │   row s+1     │
  │               │   │               │      │   │               │           │               │
  │   row 2       │   │   row n+2     │      │   │   row n+2     │           │   row s+2     │
  │               │   │               │      │   │               │           │               │
  │               │   │               │      └───┤ row  rn % rpp │           │               │
  │   ......      │   │   ......      │          │               │           │   ......      │
  │               │   │               │          │               │           │               │
  │               │   │               │          │               │           │               │
  │   row n       │   │   row m       │          │   row m       │           │   row x       │
  │               │   │               │          │               │           │               │
  └───────────────┘   └───────────────┘          └───────────────┘           └───────────────┘

 *
 */
void *row_slot(Table *table, uint32_t row_num)
{
  uint32_t page_num = row_num / ROWS_PER_PAGE;
  void *page = table->pages[page_num];
  if (page == NULL)
  {
    // Allocate memory only when we try to access page
    page = table->pages[page_num] = malloc(PAGE_SIZE);
  }

  uint32_t row_offset = row_num % ROWS_PER_PAGE;
  uint32_t byte_offset = row_offset * ROW_SIZE;
  return page + byte_offset;
}

/**
 * Parse input if it could be a meta command
 */
MetaCommandResult do_meta_command(InputBuffer *input_buffer)
{
  if (strncmp(input_buffer->buffer, ".exit", 5) == 0)
  {
    printf("Bye ~\n");
    exit(EXIT_SUCCESS);
  }
  else
  {
    return META_COMMAND_UNRECOGNIZED_COMMAND;
  }
}

PrepareResult prepare_insert(InputBuffer *input_buffer, Statement *statement)
{
  statement->type = STATEMENT_INSERT;
  char *keyword = strtok(input_buffer->buffer, " ");
  char *id_string = strtok(NULL, " ");
  char *username = strtok(NULL, " ");
  char *email = strtok(NULL, " ");
  if (id_string == NULL || username == NULL || email == NULL)
  {
    return PREPARE_SYNTAX_ERROR;
  }

  int id = atoi(id_string);
  if (id < 0)
  {
    return PREPARE_NEGATIVE_ID;
  }
  if (strlen(username) > COLUMN_USERNAME_SIZE || strlen(email) > COLUMN_EMAIL_SIZE)
  {
    return PREPARE_STRING_TOO_LONG;
  }
  statement->row_to_insert.id = id;
  strcpy(statement->row_to_insert.username, username);
  strcpy(statement->row_to_insert.email, email);

  return PREPARE_SUCCESS;
}

/**
 * Parse input if it could be an SQL statement
 */
PrepareResult prepare_statement(InputBuffer *input_buffer, Statement *statement)
{
  if (strncmp(input_buffer->buffer, "insert", 6) == 0)
  {
    return prepare_insert(input_buffer, statement);
  }

  if (strncmp(input_buffer->buffer, "select", 6) == 0)
  {
    statement->type = STATEMENT_SELECT;
    return PREPARE_SUCCESS;
  }

  return PREPARE_UNRECOGNIZED_STATEMENT;
}

ExecuteResult execute_insert(Statement *statement, Table *table)
{
  if (table->num_rows >= TABLE_MAX_ROWS)
  {
    return EXECUTE_TABLE_FULL;
  }

  Row *row_to_insert = &(statement->row_to_insert);
  serialize_row(row_to_insert, row_slot(table, table->num_rows));
  table->num_rows += 1;
  return EXIT_SUCCESS;
}

ExecuteResult execute_select(Statement *statement, Table *table)
{
  Row row;
  for (uint32_t i = 0; i < table->num_rows; i++)
  {
    deserialize_row(row_slot(table, i), &row);
    print_row(&row);
  }
  return EXECUTE_SUCCESS;
}

/**
 * Execute statement
 */
ExecuteResult execute_statement(Statement *statement, Table *table)
{
  switch (statement->type)
  {
  case (STATEMENT_INSERT):
    return execute_insert(statement, table);
  case (STATEMENT_SELECT):
    return execute_select(statement, table);
  }
}

/* --- main function --- */

int main(int argc, char *argv[])
{
  Table *table = new_table();
  InputBuffer *input_buffer = new_input_buffer();

  while (true)
  {
    print_prompt();
    read_input(input_buffer);

    if (input_buffer->buffer[0] == '.')
    {
      // meta-commands start with a dot.
      switch (do_meta_command(input_buffer))
      {
      case (META_COMMAND_SUCCESS):
        continue;
      case (META_COMMAND_UNRECOGNIZED_COMMAND):
        printf("Unrecognized command '%s' .\n", input_buffer->buffer);
        continue;
      }
    }

    Statement statement;

    // Convert the input into internal representation of a statement
    // Toy version of sqlite front-end
    switch (prepare_statement(input_buffer, &statement))
    {
    case (PREPARE_SUCCESS):
      break;
    case (PREPARE_UNRECOGNIZED_STATEMENT):
      printf("Unrecognized keyword at start of '%s'.\n", input_buffer->buffer);
      continue;
    case (PREPARE_NEGATIVE_ID):
      printf("Syntax Error: \"id\" should not be negative.\n");
      continue;
    case (PREPARE_STRING_TOO_LONG):
      printf("Syntax Error: input command is too long.\n");
      continue;
    case (PREPARE_SYNTAX_ERROR):
      printf("Syntax Error. Could not parse statement.\n");
      continue;
    }

    // Pass the prepared statement to execute
    switch (execute_statement(&statement, table))
    {
    case (EXECUTE_SUCCESS):
      printf("Executed.\n");
      break;
    case (EXECUTE_TABLE_FULL):
      printf("Error: Table full.\n");
      break;
    case (EXECUTE_DUPLICATE_KEY):
      printf("Error: Duplicate key.\n");
      break;
    };
  }
}
