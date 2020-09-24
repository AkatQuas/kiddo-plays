package controllers

import (
  "log"
  "net/http"
  "strconv"

  // A problem to import the app package
  // to use DB
  "github.com/revel/revel"
)

type App struct {
  *revel.Controller
}

type TrainResource struct {
  ID int `json:"id"`
  DriverName string `json:"driver_name"`
  OperatingStatus bool `json:"operating_status"`
}

func (c App) Index() revel.Result {
  return c.Render()
}

func (c App) Hello(myName string) revel.Result {
  c.Validation.Required(myName).Message("Your name is required!")
  c.Validation.MinSize(myName, 3).Message("Your name is not long enough!")

  if c.Validation.HasErrors() {
    c.Validation.Keep()
    c.FlashParams()
    return c.Redirect(App.Index)
  }

  return c.Render(myName)
}

func (c App) GetTrain() revel.Result {
  var train TrainResource
  // getting the values from path parameters
  id := c.Params.Route.Get("train-id")
  // use this ID to query from database and fill train table
  train.ID, _ = strconv.Atoi(id)
  train.DriverName = "Logan" // Comes from DB
  train.OperatingStatus = true // Comes from DB
  c.Response.Status = http.StatusOK
  return c.RenderJSON(train)
}

// CreateTrain handles POST on train resource
func (c App) CreateTrain() revel.Result {
  var train TrainResource
  c.Params.BindJSON(&train)
  // Use train.DriverName and train.OperatingStatus to insert into train table
  statement, _ := app.DB.Prepare("insert into train (DRIVER_NAME, OPERATING_STATUS) values (?, ?)")
  result, err := statement.Exec(train.DriverName, train.OperatingStatus)
  if err == nil {
    newID, _ = result.LastInsertId()
    train.ID = int(newID)
    c.Response.Status = http.StatusCreated
    return c.RenderJSON(train)
  }

  c.Response.Status = http.StatusInternalServerError
  return c.RenderText(err.Error())
}

// RemoveTrain implements DELETE on train resource
func (c App) RemoveTrain() revel.Result {
  id := c.Params.Route.Get("train-id")
  // Use ID to delete record from train table...
  log.Println("Successfully deleted the resource:", id)
  c.Response.Status = http.StatusNoContent
  return c.RenderText("")
}
