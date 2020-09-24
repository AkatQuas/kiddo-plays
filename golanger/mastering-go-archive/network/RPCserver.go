package main

/*
start this RPC server:
	go run RPCserver.go

connect to this RPC server:
	go run RPCclient localhost:1234
*/
import (
	"fmt"
	"math"
	"net"
	"net/rpc"
	"os"
	"sharedRPC"
)

type MyInterface struct{}

func Power(x, y float64) float64 {
	return math.Pow(x, y)
}

func (t *MyInterface) Multiply(arguments *sharedRPC.MyFloats, reply *float64) error {
	*reply = arguments.A1 * arguments.A2
	return nil
}

func (t *MyInterface) Power(arguments *sharedRPC.MyFloats, reply *float64) error {
	*reply = Power(arguments.A1, arguments.A2)
	return nil
}

func main() {
	PORT := ":1234"
	arguments := os.Args
	if len(arguments) != 1 {
		PORT = ":" + arguments[1]
	}

	myInterface := new(MyInterface)
	// rpc.Register() function makes this program an RPC server.
	rpc.Register(myInterface)

	// the RPC server uses TCP, it needs to make function calls
	// to `net.ResolveTCPAddr()` and `net.ListenTCP()`.
	t, err := net.ResolveTCPAddr("tcp4", PORT)
	if err != nil {
		fmt.Println(err)
		return
	}
	l, err := net.ListenTCP("tcp4", t)
	if err != nil {
		fmt.Println(err)
		return
	}

	for {
		c, err := l.Accept()
		if err != nil {
			continue
		}
		// The `RemoteAddr()` function returns the IP address
		// and the port number used for communicating with the RPC client.
		fmt.Printf("%s\n", c.RemoteAddr())

		// The `rpc.ServeConn()` function serves the RPC client.
		rpc.ServeConn(c)
	}
}
