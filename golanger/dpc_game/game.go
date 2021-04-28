package dpc_game

import (
	"io"
	"os"
	"time"
)

type Game interface {
	Start(numberOfPlayers int, to io.Writer)
	Finish(winner string)
}

func NewDPCGame(alerter BlindAlerter, store PlayerStore) *DPCGame {
	return &DPCGame{
		alerter: alerter,
		store:   store,
	}
}

type DPCGame struct {
	alerter BlindAlerter
	store   PlayerStore
}

func (p *DPCGame) Start(numberOfPlayers int, to io.Writer) {
	blindIncrement := time.Duration(5+numberOfPlayers) * time.Minute

	blinds := []int{100, 200, 300, 400, 500, 600, 800, 1000, 2000, 4000, 8000}
	blindTime := 0 * time.Second
	for _, blind := range blinds {
		p.alerter.ScheduleAlertAt(blindTime, blind, os.Stdout)
		blindTime = blindTime + blindIncrement
	}
}

func (p *DPCGame) Finish(winner string) {
	p.store.RecordWin(winner)
}

type ScheduledAlert struct {
	At     time.Duration
	Amount int
}
