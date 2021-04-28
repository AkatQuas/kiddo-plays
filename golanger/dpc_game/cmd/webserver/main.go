package main

import (
	"log"
	"net/http"

	"github.com/demo/dpc_game"
)

func startInMemory() {
	store := dpc_game.NewInMemoryPlayerStore()
	game := dpc_game.NewDPCGame(dpc_game.BlindAlerterFunc(dpc_game.StdOutAlerter), store)
	server, err := dpc_game.NewPlayerServer(store, game)
	if err != nil {
		log.Fatalf("start server with error %v", err)
	}
	log.Fatal(http.ListenAndServe(":4200", server))
}

const dbFileName = "dpc_game.db.json"

func startInFile() {
	store, close, err := dpc_game.FileSystemPlayerStoreFromFile(dbFileName)

	if err != nil {
		log.Fatal(err)
	}
	defer close()

	game := dpc_game.NewDPCGame(dpc_game.BlindAlerterFunc(dpc_game.StdOutAlerter), store)
	server, err := dpc_game.NewPlayerServer(store, game)
	if err != nil {
		log.Fatalf("start server with error %v", err)
	}

	if err := http.ListenAndServe(":5000", server); err != nil {
		log.Fatalf("could not listen on port 5000 %v", err)
	}
}

func main() {
	startInFile()
}
