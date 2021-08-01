#include <errno.h>
#include <fcntl.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

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

/* --- main function --- */

int main(int argc, char *argv[])
{
  InputBuffer *input_buffer = new_input_buffer();
  while (true)
  {
    print_prompt();
    read_input(input_buffer);

    if (strncmp(input_buffer->buffer, ".exit", 5) == 0)
    {
      close_input_buffer(input_buffer);
      printf("Bye ~");
      exit(EXIT_SUCCESS);
    }
    else
    {
      printf("Unrecognized command '%s' .\n", input_buffer->buffer);
    }
  }
}
