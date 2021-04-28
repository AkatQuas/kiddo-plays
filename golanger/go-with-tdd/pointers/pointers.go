package pointers

import (
	"errors"
	"fmt"
)

type Bitcoin float64

func (b Bitcoin) String() string {
	return fmt.Sprintf("%.2f BCT", b)
}

type Wallet struct {
	balance Bitcoin
}

func (w *Wallet) Deposit(deposit Bitcoin) {
	w.balance += deposit
}

func (w *Wallet) Balance() Bitcoin {
	return w.balance
}

var ErrInsufficientFunds = errors.New("insufficient fund")

func (w *Wallet) Withdraw(amount Bitcoin) error {
	if w.balance < amount {
		return ErrInsufficientFunds
	}

	w.balance -= amount
	return nil
}
