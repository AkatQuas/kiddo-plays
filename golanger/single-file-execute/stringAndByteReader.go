package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"
)

func main() {
	stringReader()
	bytesReader()
}

func stringReader() {
	// The strings.NewReader() function creates a read-only Reader from a string.
	// The strings.Reader object implements the io.Reader, io.ReaderAt,
	//   io.Seeker, io.WriterTo, io.ByteScanner, and io.RuneScanner interfaces.
	r := strings.NewReader("test")
	fmt.Println("r length:", r.Len())

	b := make([]byte, 1)
	for {
		fmt.Println("stringReader is reading...")
		n, err := r.Read(b)
		if err == io.EOF {
			break
		}

		if err != nil {
			fmt.Println(err)
			continue
		}
		fmt.Printf("Read %s Bytes: %d\n", b, n)
	}

	s := strings.NewReader("This is an error!\n")
	fmt.Println("r length:", s.Len())
	n, err := s.WriteTo(os.Stderr)

	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Printf("Wrote %d bytes to os.Stderr\n", n)
}

func bytesReader() {
	var buffer bytes.Buffer
	// put data into it using buffer.Write() and fmt.Fprintf()
	buffer.Write([]byte("This is"))
	fmt.Fprintf(&buffer, " a string!\n")
	buffer.WriteTo(os.Stdout)
	// the second call to buffer.WriteTo() has nothing to print because
	// the buffer variable will be empty after the first buffer.WriteTo() call.
	buffer.Write([]byte("empty supplement\n"))
	buffer.WriteTo(os.Stdout)

	buffer.Reset()
	// buffer.Truncate(0)
	buffer.Write([]byte("Mastering Go!"))
	r := bytes.NewReader([]byte(buffer.String()))
	fmt.Println(buffer.String())
	for {
	    fmt.Println("bytesReader reading ->")
		b := make([]byte, 3)
		n, err := r.Read(b)
		if err == io.EOF {
			break
		}

		if err != nil {
			fmt.Println(err)
			continue
		}
		fmt.Printf("Read %d Bytes: %s\n", n, b)
	}
	fmt.Println("After bytes reading:",buffer.String())
}
