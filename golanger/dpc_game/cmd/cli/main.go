package main

import (
	"fmt"
	"log"
	"os"

	"github.com/demo/dpc_game"
)

const dbFileName = "dpc_game.db.json"

func main() {
	store, close, err := dpc_game.FileSystemPlayerStoreFromFile(dbFileName)
	defer close()

	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Let's play dpc_game")
	fmt.Println(`Type "{Name} wins" to record a win`)
	game := dpc_game.NewDPCGame(dpc_game.BlindAlerterFunc(dpc_game.StdOutAlerter), store)
	cli := dpc_game.NewCLI(os.Stdin, os.Stdout, game)
	cli.Play()
}
