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
 * Prints a prompt to user.
 * Do this before reading each line of input.
 */
void print_prompt()
{
  printf("db > ");
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

/**
 * Parse input if it could be an SQL statement
 */
PrepareResult prepare_statement(InputBuffer *input_buffer, Statement *statement)
{
  if (strncmp(input_buffer->buffer, "insert", 6) == 0)
  {
    statement->type = STATEMENT_INSERT;
    return PREPARE_SUCCESS;
  }

  if (strncmp(input_buffer->buffer, "select", 6) == 0)
  {
    statement->type = STATEMENT_SELECT;
    return PREPARE_SUCCESS;
  }

  return PREPARE_UNRECOGNIZED_STATEMENT;
}

/**
 * Execute statement with stubs
 */
void execute_statement(Statement *statement)
{
  switch (statement->type)
  {
  case (STATEMENT_INSERT):
    printf("This is where we would do an insert.\n");
    break;
  case (STATEMENT_SELECT):
    printf("This is where we would do a select.\n");
    break;
  }
}

/* --- main function --- */

int main(int argc, char *argv[])
{
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
      printf("Unrecognized keyword at start of '%s' .\n", input_buffer->buffer);
      continue;
    case (PREPARE_NEGATIVE_ID):
      printf("Syntax Error: \"id\" should not be negative.\n");
      continue;
    case (PREPARE_STRING_TOO_LONG):
      printf("Syntax Error: input command is too long.\n");
      continue;
    case (PREPARE_SYNTAX_ERROR):
      printf("Syntax Error.\n");
      continue;
    }

    // Pass the prepared statement to execute
    execute_statement(&statement);
    printf("Executed.\n");
  }
}
