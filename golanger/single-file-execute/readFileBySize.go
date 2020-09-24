package main

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"strconv"
)

func readSize(f *os.File, size int) []byte {
	fmt.Println("readSize read once->")
	buffer := make([]byte, size)

	n, err := f.Read(buffer)
	if err == io.EOF {
		return nil
	}

	if err != nil {
		fmt.Println(err)
		return nil
	}

	return buffer[0:n]
}

func main() {
	arguments := os.Args
	if len(arguments) != 3 {
		fmt.Println("usage: readSize <buffer size:int> <filename:string>")
		return
	}

	bufferSize, err := strconv.Atoi(os.Args[1])
	if err != nil {
		fmt.Println(err)
		return
	}

	file := os.Args[2]
	f, err := os.Open(file)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer f.Close()

	for {
		readData := readSize(f, bufferSize)
		if readData != nil {
			fmt.Print(string(readData))
		} else {
			break
		}
	}

	readFromDevRandom()
}

func readFromDevRandom() {
	fmt.Println("A magic function to read random from /dev/random")
	f, err := os.Open("/dev/random")
	defer f.Close()

	if err != nil {
		fmt.Println(err)
		return
	}

	var seed int64
	binary.Read(f, binary.LittleEndian, &seed)
	fmt.Println("Seed:", seed)
}
