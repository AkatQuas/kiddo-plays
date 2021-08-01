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
 * The Pager accesses the page cache and the file
 */
typedef struct
{
  int file_descriptor;
  uint32_t file_length;
  void *pages[TABLE_MAX_PAGES];
} Pager;

/**
 * Table structure points to pages of rows
 * and keeps track of how many rows there are
 */
typedef struct
{
  uint32_t num_rows;
  Pager *pager;
} Table;

/**
 * Cursor represents a location in the table
 */
typedef struct
{
  Table *table;
  uint32_t row_num;
  bool end_of_table; // Indicates a position one past the last element
} Cursor;

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
/**
 * Opens the database file and keeps track of its size.
 * It also initializes the page cache to all NULLs.
 */
Pager *pager_open(const char *filename)
{
  int fd = open(filename,
                O_RDWR |     // Read/Write mode
                    O_CREAT, // Create file if not exist
                S_IWUSR |    // User write permission
                    S_IRUSR  // User read permission
  );
  if (fd == -1)
  {
    printf("Unable to open file\n");
    exit(EXIT_FAILURE);
  }

  off_t file_length = lseek(fd, 0, SEEK_END);
  Pager *pager = malloc(sizeof(Pager));
  pager->file_descriptor = fd;
  pager->file_length = file_length;

  for (uint32_t i = 0; i < TABLE_MAX_PAGES; i++)
  {
    pager->pages[i] = NULL;
  }
  return pager;
}

/**
 * Fetch a page from Pager
 *
 * Assuming pages are saved one after the other.
 * Page 0 at offset 0, page 1 at offset 4k, page2 at offset 8k, ...
 *
 * The page will be added to the file when flush cache to disk.
 */
void *get_page(Pager *pager, uint32_t page_num)
{
  if (page_num > TABLE_MAX_PAGES)
  {
    printf("Tried to fetch page number out of bounds. %d >  %d\n", page_num, TABLE_MAX_PAGES);
    exit(EXIT_FAILURE);
  }

  if (pager->pages[page_num] == NULL)
  {
    // Cache miss. Allocate memory and load from file.
    void *page = malloc(PAGE_SIZE);
    uint32_t num_pages = pager->file_length / PAGE_SIZE;

    // Save a partial page at the end of the file
    if (pager->file_length % PAGE_SIZE)
    {
      num_pages += 1;
    }

    if (page_num <= num_pages)
    {
      lseek(pager->file_descriptor, page_num * PAGE_SIZE, SEEK_SET);
      ssize_t bytes_read = read(pager->file_descriptor, page, PAGE_SIZE);
      if (bytes_read == -1)
      {
        printf("Error reading file: %d\n", errno);
        exit(EXIT_FAILURE);
      }
    }
    pager->pages[page_num] = page;
  }

  return pager->pages[page_num];
}

void pager_flush(Pager *pager, uint32_t page_num, uint32_t size)
{
  if (pager->pages[page_num] == NULL)
  {
    printf("Tried to flush null page\n");
    exit(EXIT_FAILURE);
  }

  off_t offset = lseek(pager->file_descriptor, page_num * PAGE_SIZE, SEEK_SET);

  if (offset == -1)
  {
    printf("Error seeking: %d\n", errno);
    exit(EXIT_FAILURE);
  }

  ssize_t bytes_written = write(pager->file_descriptor, pager->pages[page_num], size);

  if (bytes_written == -1)
  {
    printf("Error writing: %d\n", errno);
    exit(EXIT_FAILURE);
  }
}

/**
 * Opening a connection to the database.
 */
Table *db_open(const char *filename)
{
  Pager *pager = pager_open(filename);
  uint32_t num_rows = pager->file_length / ROW_SIZE;
  Table *table = malloc(sizeof(Table));
  table->pager = pager;
  table->num_rows = num_rows;
  return table;
}

void db_close(Table *table)
{
  Pager *pager = table->pager;
  uint32_t num_full_pages = table->num_rows / ROWS_PER_PAGE;

  for (uint32_t i = 0; i < num_full_pages; i++)
  {
    if (pager->pages[i] == NULL)
    {
      continue;
    }
    pager_flush(pager, i, PAGE_SIZE);
    free(pager->pages[i]);
    pager->pages[i] = NULL;
  }

  // There may be a partial page to write to the end of the file
  // This should not be needed after we switch to a B-tree
  uint32_t num_additional_rows = table->num_rows % ROWS_PER_PAGE;
  if (num_additional_rows > 0)
  {
    uint32_t page_num = num_full_pages;
    if (pager->pages[page_num] != NULL)
    {
      pager_flush(pager, page_num, num_additional_rows * ROW_SIZE);
      free(pager->pages[page_num]);
      pager->pages[page_num] = NULL;
    }
  }

  int result = close(pager->file_descriptor);
  if (result == -1)
  {
    printf("Error closing db file.\n");
    exit(EXIT_FAILURE);
  }
  for (uint32_t i = 0; i < TABLE_MAX_PAGES; i++)
  {
    void *page = pager->pages[i];
    if (page)
    {
      free(page);
      pager->pages[i] = NULL;
    }
  }

  free(pager);
  free(table);
}

Cursor *table_start(Table *table)
{
  Cursor *cursor = malloc(sizeof(Cursor));
  cursor->table = table;
  cursor->row_num = 0;
  cursor->end_of_table = (table->num_rows == 0);

  return cursor;
}

Cursor *table_end(Table *table)
{
  Cursor *cursor = malloc(sizeof(Cursor));
  cursor->table = table;
  cursor->row_num = table->num_rows;
  cursor->end_of_table = true;

  return cursor;
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
  strncpy(destination + USERNAME_OFFSET, source->username, USERNAME_SIZE);
  strncpy(destination + EMAIL_OFFSET, source->email, EMAIL_SIZE);
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

void cursor_advance(Cursor *cursor)
{
  cursor->row_num += 1;
  if (cursor->row_num >= cursor->table->num_rows)
  {
    cursor->end_of_table = true;
  }
}

/**
 * cursor_value return a pointer to the postion described by the cursor
 */
void *cursor_value(Cursor *cursor)
{
  uint32_t row_num = cursor->row_num;
  uint32_t page_num = row_num / ROWS_PER_PAGE;
  void *page = get_page(cursor->table->pager, page_num);

  uint32_t row_offset = row_num % ROWS_PER_PAGE;
  uint32_t byte_offset = row_offset * ROW_SIZE;
  return page + byte_offset;
}

/**
 * Parse input if it could be a meta command
 */
MetaCommandResult do_meta_command(InputBuffer *input_buffer, Table *table)
{
  if (strncmp(input_buffer->buffer, ".exit", 5) == 0)
  {
    db_close(table);
    printf("Bye ~");
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

  /**
   * When inserting the row
   * open a cursor at the end of table,
   * write to that cursor location, and then close cursor
   */

  Row *row_to_insert = &(statement->row_to_insert);
  Cursor *cursor = table_end(table); // open the cursor at the end of table
  serialize_row(row_to_insert, cursor_value(cursor));
  table->num_rows += 1;

  free(cursor); // close cursor

  return EXIT_SUCCESS;
}

ExecuteResult execute_select(Statement *statement, Table *table)
{
  /**
   * When selecting all rows in the table,
   * open a cursor at the start of table,
   * print the row, advance the cursor to next row,
   * repeat until reaching the end of the table.
   */
  Cursor *cursor = table_start(table);
  Row row;

  while (!(cursor->end_of_table))
  {
    deserialize_row(cursor_value(cursor), &row);
    print_row(&row);
    cursor_advance(cursor);
  }

  free(cursor);
  // Row is a local variable, would be freed automatically

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
  if (argc < 2)
  {
    printf("Must supply a database filename.\n");
    exit(EXIT_FAILURE);
  }
  char *filename = argv[1];

  Table *table = db_open(filename);
  InputBuffer *input_buffer = new_input_buffer();

  while (true)
  {
    print_prompt();
    read_input(input_buffer);

    if (input_buffer->buffer[0] == '.')
    {
      // meta-commands start with a dot.
      switch (do_meta_command(input_buffer, table))
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
