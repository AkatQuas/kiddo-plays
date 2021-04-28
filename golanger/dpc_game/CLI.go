package dpc_game

import (
	"bufio"
	"fmt"
	"io"
	"io/ioutil"
	"strconv"
	"strings"
)

func NewCLI(in io.Reader, out io.Writer, game Game) *CLI {
	return &CLI{
		in:   bufio.NewScanner(in),
		out:  out,
		game: game,
	}
}

type CLI struct {
	in   *bufio.Scanner
	out  io.Writer
	game Game
}

const (
	PlayerPrompt         = "Please enter the number of players: "
	BadPlayerInputErrMsg = "Bad value received for number of players, please try again with a number"
)

func (cli *CLI) Play() {
	fmt.Fprint(cli.out, PlayerPrompt)

	numberOfPlayersInput := cli.readLine()
	numberOfPlayers, err := strconv.Atoi(strings.Trim(numberOfPlayersInput, "\n"))
	if err != nil {
		fmt.Fprint(cli.out, BadPlayerInputErrMsg)
		return
	}

	cli.game.Start(numberOfPlayers, ioutil.Discard)

	winnerInput := cli.readLine()
	winner := extractWinner(winnerInput)
	cli.game.Finish(winner)
}

func (cli *CLI) readLine() string {
	cli.in.Scan()
	return cli.in.Text()
}

func extractWinner(userInput string) string {
	return strings.Replace(userInput, " wins", "", 1)
}
