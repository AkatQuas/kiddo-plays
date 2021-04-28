package pointers

import "testing"

func TestWallet(t *testing.T) {
	t.Run("Deposit: error print as string", func(t *testing.T) {
		wallet := Wallet{}
		wallet.Deposit(Bitcoin(10.0))
		assertBalance(t, wallet, Bitcoin(10))
	})

	t.Run("Deposit: error print as number", func(t *testing.T) {
		wallet := Wallet{}
		wallet.Deposit(Bitcoin(10.0))

		got := wallet.Balance()

		want := Bitcoin(10.0)
		if got != want {
			t.Errorf("got %.2f want %.2f", got, want)
		}
	})

	t.Run("Withdraw", func(t *testing.T) {
		wallet := Wallet{
			balance: Bitcoin(20.0),
		}
		err := wallet.Withdraw(Bitcoin(10.0))
		assertBalance(t, wallet, Bitcoin(10.0))
		// necessary for checking no error thrown
		assertNoError(t, err)
	})

	t.Run("Withdraw insufficient funds", func(t *testing.T) {
		startingBalance := Bitcoin(20.0)
		wallet := Wallet{startingBalance}
		err := wallet.Withdraw(Bitcoin(100.0))

		assertBalance(t, wallet, startingBalance)
		assertError(t, err, ErrInsufficientFunds)
	})
}

func assertBalance(t testing.TB, wallet Wallet, want Bitcoin) {
	t.Helper()
	got := wallet.Balance()
	if got != want {
		t.Errorf("got %s want %s", got, want)
	}
}

func assertNoError(t testing.TB, got error) {
	t.Helper()
	if got != nil {
		t.Fatal("got an error but didn't want one")
	}
}

func assertError(t testing.TB, got error, want error) {
	t.Helper()
	if got == nil {
		t.Fatal("wanted an error but didn't get one")
	}
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}
