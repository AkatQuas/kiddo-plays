package dpc_game

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
)

type FileSystemPlayerStore struct {
	database *json.Encoder
	league   League
}

func NewFileSystemPlayerStore(file *os.File) (*FileSystemPlayerStore, error) {
	err := initialPlayerDBFile(file)
	if err != nil {
		return nil, fmt.Errorf("problem initialising player db file, %v", err)
	}
	league, err := NewLeague(file)
	if err != nil {
		return nil, fmt.Errorf("problem loading player store from file %s, %v", file.Name(), err)
	}

	return &FileSystemPlayerStore{
		database: json.NewEncoder(&tape{file}),
		league:   league,
	}, nil
}

// sort by Wins, bigger comes first
func (f *FileSystemPlayerStore) GetLeague() League {
	sort.Slice(f.league, func(i, j int) bool {
		return f.league[i].Wins > f.league[j].Wins
	})
	return f.league
}

func (f *FileSystemPlayerStore) GetPlayerScore(name string) int {
	player := f.league.Find(name)
	if player != nil {
		return player.Wins
	}
	return 0
}

func (f *FileSystemPlayerStore) GetPlayerScoreUseIterate(name string) int {
	var wins int
	for _, player := range f.league {
		if player.Name == name {
			wins = player.Wins
			break
		}
	}
	return wins
}

func (f *FileSystemPlayerStore) RecordWin(name string) {
	player := f.league.Find(name)
	if player != nil {
		player.Wins++
	} else {
		f.league = append(f.league, Player{name, 1})
	}
	f.database.Encode(f.league)
}

func (f *FileSystemPlayerStore) RecordWinUseIterate(name string) {
	league := f.GetLeague()
	for i, player := range league {
		if player.Name == name {
			league[i].Wins++
		}
	}
	f.database.Encode(f.league)
}

func initialPlayerDBFile(file *os.File) error {
	file.Seek(0, 0)
	info, err := file.Stat()
	if err != nil {
		return fmt.Errorf("problem getting file info from file %s, %v", file.Name(), err)
	}
	if info.Size() == 0 {
		file.Write([]byte("[]"))
		file.Seek(0, 0)
	}
	return nil
}

func FileSystemPlayerStoreFromFile(path string) (*FileSystemPlayerStore, func(), error) {
	db, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0666)

	if err != nil {
		return nil, nil, fmt.Errorf("problem opening %s %v", path, err)
	}

	closeFunc := func() {
		db.Close()
	}

	store, err := NewFileSystemPlayerStore(db)

	if err != nil {
		return nil, nil, fmt.Errorf("problem creating file system player store, %v ", err)
	}

	return store, closeFunc, nil
}
