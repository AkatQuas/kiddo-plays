package main

import (
    "fmt"
    "image"
    "log"
    "time"
)

func main() {
    r := NewRoverDriver()
    time.Sleep(3 * time.Second)
    r.Left()
    time.Sleep(3 * time.Second)
    r.Right()
    time.Sleep(3 * time.Second)
    r.Stop()
    time.Sleep(3 * time.Second)
    r.Start()
    time.Sleep(3 * time.Second)
}

type command int

const (
    right = command(0)
    left  = command(1)
    start = command(2)
    stop  = command(3)
)

type RoverDriver struct {
    commands chan command
}

// drive is response for driving the rover.
// It is expected to be started in a goroutine
func (r *RoverDriver) drive() {
    position := image.Point{X: 0, Y: 0}
    direction := image.Point{X: 1, Y: 0}
    updateInterval := 250 * time.Millisecond
    nextMove := time.After(updateInterval)
    speed := 1
    for {
        select {
        case c := <-r.commands:
            switch c {
            case right:
                direction = image.Point{
                    X: -direction.Y,
                    Y: direction.X,
                }
            case left:
                direction = image.Point{
                    X: direction.Y,
                    Y: -direction.X,
                }
            case stop:
                speed = 0
            case start:
                speed = 1
            }
            log.Printf("new direction %v with speed %d", direction, speed)
        case <-nextMove:
            position = position.Add(direction.Mul(speed))
            log.Printf("moved to %v", position)
            nextMove = time.After(updateInterval)
        }
    }
}

// Left turns the rover left
func (r *RoverDriver) Left() {
    r.commands <- left
}

// Right turns the rover right
func (r *RoverDriver) Right() {
    r.commands <- right
}

// Stop halts the rover
func (r *RoverDriver) Stop() {
    r.commands <- stop
}

// Start gets the rover moving.
func (r *RoverDriver) Start() {
    r.commands <- start
}

func NewRoverDriver() *RoverDriver {
    r := &RoverDriver{
        commands: make(chan command),
    }
    go r.drive()
    return r
}

func worker() {
    position := image.Point{X: 10, Y: 10}
    direction := image.Point{X: 1, Y: 0}
    next := time.After(time.Second)
    for {
        select {
        case <-next:
            position = position.Add(direction)
            fmt.Println("Current position is ", position)
            next = time.After(time.Second)
        }
    }
}
