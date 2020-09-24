package main

import (
  "database/sql"
  "log"
  "os"

  _ "github.com/mattn/go-sqlite3"
)

type Book struct {
  id int
  name string
  author string
}

func main() {
  db, err := sql.Open("sqlite3", "./books.db")
  if err != nil {
    log.Fatal(err)
    os.Exit(1)
  }
  log.Println(db)

  // Create table
  statement, err := db.Prepare("CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY, isbn INTEGER, author VARCHAR(64), name VARCHAR(64) NULL)")
  statement.Exec()
  // after execution, the err pointer would be given the real result

  if err != nil {
    log.Fatal("Error in creating table")
    os.Exit(1)
  }
  log.Println("Successfully created table books!")


  // Create 
  statement, err = db.Prepare("INSERT INTO books (name, author, isbn) VALUES (?, ?, ?)")
  statement.Exec("A Tale of Two Cities", "Charles Dickens", "140430547")
  if err != nil {
    log.Fatal("Error in inserting", err)
    os.Exit(1)
  }

  log.Println("Inserted the book into database!")

  rows, _ := db.Query("SELECT id, name, author FROM books")
  var tempBook Book
  for rows.Next() {
    rows.Scan(&tempBook.id, &tempBook.name, &tempBook.author)
    log.Printf("ID:%d, Book:%s, Author:%s\n", tempBook.id, tempBook.name, tempBook.author)
  }
  // Update
  statement, _ = db.Prepare("update books set name=? where id=?")
  statement.Exec("The Tale of Twe Cities", 1)
  log.Println("Successfully updated the book in datebase!")

  // Delete
  statement, _ = db.Prepare("delete from books where id=?")
  statement.Exec(1)
  log.Println("Successfully deleted the book in database!")
}
