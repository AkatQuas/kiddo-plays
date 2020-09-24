package main

import (
	"fmt"
)

func createUser(name string, role string) *User {
	newUser := User{
		name:   name,
		access: role,
	}
	return &newUser
}

func grantAdmin(a *User) {
	a.access = "admin"
}

func main() {
	user := createUser("John", "user")
	createUserPointer := &user
	grantAdmin(*createUserPointer)
	fmt.Println(user.name, "is", user.access)
}

type User struct {
	name   string
	access string
}
