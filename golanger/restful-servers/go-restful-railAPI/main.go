package main

import (
  "database/sql"
  "encoding/json"
  "log"
  "net/http"
  "os"
  "time"

  "github.com/AkatQuas/dbutils"
  "github.com/emicklei/go-restful"
  _ "github.com/mattn/go-sqlite3"
)

// DB driver visible to whole program
var DB *sql.DB

// TrainResource is the model for holding rail information
type TrainResource struct {
  ID int
  DriverName string
  OperatingStatus bool
}

// Register adds paths and routes to container
func (t *TrainResource) Register(container *restful.Container) {
  ws := new(restful.WebService)

  ws.
    Path("/v1/trains").
    Consumes(restful.MIME_JSON).
    Produces(restful.MIME_JSON) // you can specify this per route as well

  ws.Route(ws.GET("/{train-id}").To(t.getTrain))
  ws.Route(ws.POST("").To(t.createTrain))
  ws.Route(ws.DELETE("/{train-id}").To(t.removeTrain))

  container.Add(ws)
}

// GET http://<host:port>/v1/trains/{train-id}
func (t TrainResource) getTrain(request *restful.Request, response *restful.Response) {
  id := request.PathParameter("train-id")
  err := DB.QueryRow("select ID, DRIVER_NAME, OPERATING_STATUS FROM train where id=?", id).Scan(&t.ID, &t.DriverName, &t.OperatingStatus)
  if err != nil {
    log.Println("TrainResource.getTrain with error:", err)
    response.AddHeader("Content-Type", "text/plain")
    response.WriteErrorString(http.StatusNotFound, "Train could not be found.")
  } else {
    response.WriteEntity(t)
  }
}

// POST http://<host:port>/v1/trains
func (t TrainResource) createTrain(request *restful.Request, response *restful.Response) {
  log.Println(request.Request.Body)
  decoder := json.NewDecoder(request.Request.Body)
  var b TrainResource
  err := decoder.Decode(&b)
  log.Println(b.DriverName, b.OperatingStatus)
  // Error handling is obvious here.
  statement, _ := DB.Prepare("insert into train (DRIVER_NAME, OPERATING_STATUS) values (?, ?)")
  result, err := statement.Exec(b.DriverName, b.OperatingStatus)
  if err == nil {
    newID, _ := result.LastInsertId()
    b.ID = int(newID)
    response.WriteHeaderAndEntity(http.StatusCreated, b)
  } else {
    response.AddHeader("Content-Type", "text/plain")
    response.WriteErrorString(http.StatusInternalServerError, err.Error())
  }
}

// DELETE http://<host:port>/v1/trains/{train-id}
func (t TrainResource) removeTrain(request *restful.Request, response *restful.Response) {
  id := request.PathParameter("train-id")
  statement, _ := DB.Prepare("delete from train where id=?")
  _, err := statement.Exec(id)
  if err == nil {
    response.WriteHeader(http.StatusNoContent)
  } else {
    response.AddHeader("Content-Type", "text/plain")
    response.WriteErrorString(http.StatusInternalServerError, err.Error())
  }
}

// StationResource holds information about locations
type StationResource struct {
  ID int
  Name string
  OpeningTime string
  ClosingTime string
}

// Register adds paths and routes to container
func (t *StationResource) Register(container *restful.Container) {
  ws := new(restful.WebService)

  ws.
    Path("/v1/stations").
    Consumes(restful.MIME_JSON).
    Produces(restful.MIME_JSON) // you can specify this per route as well

  ws.Route(ws.GET("/{station-id}").To(t.getStation))
  ws.Route(ws.POST("").To(t.createStation))
  ws.Route(ws.DELETE("/{station-id}").To(t.removeStation))

  container.Add(ws)
}

// GET http://<host:port>/v1/stations/{station-id}
func (s StationResource) getStation(request *restful.Request, response *restful.Response) {
  id := request.PathParameter("station-id")
  err := DB.QueryRow("select ID, NAME, CAST(OPENING_TIME as CHAR), CAST(CLOSING_TIME as CHAR) FROM station where id=?", id).Scan(&s.ID, &s.Name, &s.OpeningTime, &s.ClosingTime)
  if err != nil {
    log.Println("StationResource.getStation with error:", err)
    response.AddHeader("Content-Type", "text/plain")
    response.WriteErrorString(http.StatusNotFound, "Station could not be found.")
  } else {
    response.WriteEntity(s)
  }
}

// POST http://<host:port>/v1/stations
func (s StationResource) createStation(request *restful.Request, response *restful.Response) {
  log.Println(request.Request.Body)
  decoder := json.NewDecoder(request.Request.Body)
  var b StationResource
  err := decoder.Decode(&b)
  log.Println(b.Name, b.OpeningTime, b.ClosingTime)
  // Error handling is obvious here.
  statement, _ := DB.Prepare("insert into station (NAME, OPENING_TIME, CLOSING_TIME) values (?, ?, ?)")
  // TODO insert time
  // In the future, we will figure out how to do this
  result, err := statement.Exec(b.Name, b.OpeningTime, b.ClosingTime)
  if err == nil {
    newID, _ := result.LastInsertId()
    b.ID = int(newID)
    response.WriteHeaderAndEntity(http.StatusCreated, b)
  } else {
    response.AddHeader("Content-Type", "text/plain")
    response.WriteErrorString(http.StatusInternalServerError, err.Error())
  }
}

// DELETE http://<host:port>/v1/stations/{station-id}
func (s StationResource) removeStation(request *restful.Request, response *restful.Response) {
  id := request.PathParameter("station-id")
  statement, _ := DB.Prepare("delete from station where id=?")
  _, err := statement.Exec(id)
  if err == nil {
    response.WriteHeader(http.StatusNoContent)
  } else {
    response.AddHeader("Content-Type", "text/plain")
    response.WriteErrorString(http.StatusInternalServerError, err.Error())
  }
}


// ScheduleResource links both trains and stations
type ScheduleResource struct {
  ID int
  TrainID int
  StationID int
  ArrivalTime time.Time
}

func main() {
  var err error
  // Connect to Database
  DB, err = sql.Open("sqlite3", "./railapi.db")
  if err != nil {
    log.Fatal("Database Driver creation failed!")
    os.Exit(1)
  }

  dbutils.Initialize(DB)
  wsContainer := restful.NewContainer()
  wsContainer.Router(restful.CurlyRouter{})
  t := TrainResource{}
  t.Register(wsContainer)

  s := StationResource{}
  s.Register(wsContainer)
  log.Printf("start listening on localhost:9090")
  server := &http.Server{Addr: ":9090", Handler: wsContainer}
  log.Fatal(server.ListenAndServe())
}
