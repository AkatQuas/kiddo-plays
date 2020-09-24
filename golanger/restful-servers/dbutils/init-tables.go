package dbutils

import (
  "database/sql"
  "log"
)

func Initialize(dbDriver *sql.DB) {
  statement, driverError := dbDriver.Prepare(train)
  if driverError != nil {
    log.Println(driverError)
  }

  // Create train table
  _, statementError := statement.Exec()
  if statementError != nil {
    log.Println("Tabel already exists!")
  }

  // Create station table
  statement, _ = dbDriver.Prepare(station)
  statement.Exec()

  // Create schedule table
  statement, _ = dbDriver.Prepare(schedule)
  statement.Exec()

  log.Println("All tables created/initialized successfully!")
}

