package main

import (
    "encoding/json"
    "fmt"
    "log"
    "math"
    _ "os"
    "sort"
    "time"
)

type Digit int
type Power2 int

func main() {
    usingMap()
    usingArrayAndSlice()
    amazingSlice()
    usingInlineStruct()
    usingStruct()
    usingInterface()
    mockUser()
    usingSizer()

    const (
        Zero Digit = iota
        One // 1
        Two // 2
        Three // 3
        Four // 4
    )
    fmt.Println(One)
    fmt.Println(Two)

    const (
        p2_0 Power2 = 1 << iota
        _ // ignored
        p2_2 // 4
        _ // ignored
        p2_4 // 16
        _ // ignored
        p2_6 // 64
    )

    fmt.Println("2^0:", p2_0)
    fmt.Println("2^2:", p2_2)
    fmt.Println("2^4:", p2_4)
    fmt.Println("2^6:", p2_6)
}

/*
    Although Go maps do not exclude any data types from being used as keys,
    for a data type to be used as a key, it must be comparable,
    which means that the Go compiler must be able to differentiate one key from another or,
    put simply, that the keys of a map must support the `==` operator.
 */

func usingMap() {
    // map[data_type T]data_type S{[key: T]: [values: S]
    sammy := map[string]string{
        "name":     "Sammy",
        "animal":   "shark",
        "color":    "blue",
        "location": "ocean",
    }
    fmt.Println("the whole map: ", sammy)
    fmt.Println(`map by key "name": `, sammy["name"])
    fmt.Println(`map by key "color": `, sammy["color"])
    fmt.Println("iteration by key")
    for key, value := range sammy {
        fmt.Printf("%q is the key for the value %q\n", key, value)
    }

    keys := []string{}
    for key := range sammy {
        keys = append(keys, key)
    }
    fmt.Printf("%q\n", keys)
    sort.Strings(keys)
    fmt.Printf("%q\n", keys)

    items := make([]string, len(sammy))
    var i int
    i = 0
    for _, v := range sammy {
        items[i] = v
        i++
    }
    fmt.Printf("%q\n", items)

    count, ok := sammy["count"]
    if ok {
        fmt.Printf("sammy has a key named \"count\" with value %q\n", count)
    } else {
        fmt.Printf("sammy does not have a key named \"count\" \n")
    }

    sammy["count"] = "12"
    count = sammy["count"]
    fmt.Printf("sammy now has a key named \"count\" with value %q\n", count)
    delete(sammy, "count")
    fmt.Printf("\"count\" with value %q\n", count)
    fmt.Println(sammy)

    planets := map[string]string{
        "Earth": "Sector ZZ9",
        "Mars":  "Sector ZZ9",
    }
    planetsMarkII := planets
    planets["Earth"] = "whoops"
    fmt.Println("planets also changed", planets)
    fmt.Println("planetsMarkII also impacted", planetsMarkII)
    delete(planets, "Earth")
    fmt.Println("planetMarkII impacted", planetsMarkII)

    temperatures := []float64{
        -28.0, -28.0, 32.0, -31.0, -29.0, -23.0, -29.0, -28.0, -33.0,
    }

    groups := make(map[float64][]float64)
    for _, t := range temperatures {
        // to avoid precision problem
        g := math.Trunc(t/10) * 10
        groups[g] = append(groups[g], t)
    }
    for g, temperatures := range groups {
        fmt.Printf("%v: %v\n", g, temperatures)
    }

    iMap := make(map[string]int)
    iMap["k1"] = 12
    iMap["k2"] = 13
    fmt.Println("iMap:", iMap)
    anotherMap := map[string]int{
        "k1": 12,
        "k2": 13,
    }
    fmt.Println("anotherMap:", anotherMap)
    delete(anotherMap, "k1")
    delete(anotherMap, "k1")
    delete(anotherMap, "k1")
    fmt.Println("anotherMap:", anotherMap)
    _, ok := iMap["doesItExist"]
    if ok {
        fmt.Println("Exists!")
    } else {
        fmt.Println("Does NOT exist")
    }
}

func failMap() {
    aMap := map[string]int{}
    aMap = nil
    fmt.Println(aMap)
    // this will panic the program
    aMap["test"] = 1
}

func terraform(planets []string) {
    for i := range planets {
        planets[i] = "New " + planets[i]
    }
}
func terraform5(planets [5]string) {
    for i := range planets {
        planets[i] = "New " + planets[i]
    }
}

/*
 Slices are implemented using arrays internally, which means that Go uses an underlying array for each slice.
 */

func usingArrayAndSlice() {
    // [capacity]data_type{element_values}
    coral := [...]string{
        "blue coral",
        "staghorn coral",
        "pillar coral",
        "elkhorn coral",
    }
    fmt.Println(coral)

    fmt.Printf("%q\n", coral)
    for _, v := range coral {
        fmt.Println("Sammy loves " + v)
    }

    fmt.Println(coral[1:3])
    fmt.Println(coral[:3])
    fmt.Println(coral[2:])
    fmt.Printf("%q with capacity %d\n", coral, cap(coral))

    // seatures is infered with type: [5]string
    // which is an array!
    seatures := [...]string{
        "shark",
        "cuttlefish",
        "squid",
        "mantis shrimp",
        "aneone",
    }
    otherSeatures := seatures // otherSeatures make a copy of seatures
    otherSeatures[2] += "liquid"
    // syntax error: slice could only be compared with `nil`
    // if seatures == otherSeatures {
    // }
    fmt.Printf("seatures -> %q\n", seatures)
    fmt.Printf("otherSeatures -> %q \n", otherSeatures)
    terraform5(seatures) // this function doesn't manipulate the original `seatures`
    fmt.Printf("after terraform5 -> %q \n", seatures)

    // using sliced
    seatureSlice := seatures[:]
    terraform(seatureSlice) // this function manipulate the original `seatures`
    fmt.Printf("after terraform -> %q \n", seatures)
    fmt.Printf("after terraform -> %q \n", seatureSlice)

    coralSlice := coral[:]
    coralSlice = append(coralSlice, "black coral", "antipathes", "soft coral")
    // after appedication, the internal array might change to another one
    fmt.Println(coralSlice, "capacity ->", cap(coralSlice), "length ->", len(coralSlice))

    moreCoral := []string{"massive coral", "leptopsammia"}
    coralSlice = append(coralSlice, moreCoral...)
    // after appedication, the internal array might change to another one
    fmt.Println(coralSlice, "capacity ->", cap(coralSlice), "length ->", len(coralSlice))

    coralSlice = append(coralSlice[:3], coralSlice[6:]...)
    // after appedication, the internal array might change to another one
    fmt.Println(coralSlice, "capacity ->", cap(coralSlice), "length ->", len(coralSlice))

    seaNames := [][4]string{
        {"shark", "octopus", "squid"},
        {"Shammy", "Jesse", "Drew", "Jamie"},
    }
    fmt.Println(seaNames[1][0], seaNames[0][0])


    s1 := []int{1, 2}
    s2 := s1[:]
    s1[1] = 4
    // at this time, s1 and s2 both point to the same internal array
    fmt.Printf("%v %[1]T\n", &s2)
    fmt.Printf("%v\n", &s1)
    s1 = append(s1, 5, 7,9,10)
    // at this time, s1 is different from s2
    fmt.Printf("%v %[1]T\n", &s2)
    fmt.Printf("%v\n", &s1)

    a6 := []int{-10, 1, 2, 3, 4, 5}
    a4 := []int{-1, -2, -3, -4}
    fmt.Println("a6:", a6)
    fmt.Println("a4:", a4)
    copy(a6, a4)
    // only four elements in a4 are copied to a6
    fmt.Println("a6:", a6)
    fmt.Println("a4:", a4)
    fmt.Println()

    b6 := []int{-10, 1, 2, 3, 4, 5}
    b4 := []int{-1, -2, -3, -4}
    fmt.Println("b6:", b6)
    fmt.Println("b4:", b4)
    copy(b4, b6)
    // only four elements in b6 are copied to b6
    fmt.Println("b6:", b6)
    fmt.Println("b4:", b4)

    fmt.Println()
    array4 := [4]int{4, -4, 4, -4}
    s6 := []int{1, 1, -1, -1, 5, -5}
    copy(s6, array4[0:])
    // type should be the same, slice
    fmt.Println("array4:", array4[0:])
    fmt.Println("s6:", s6)
    fmt.Println()


    array5 := [5]int{5, -5, 5, -5, 5}
    s7 := []int{7, 7, -7, -7, 7, -7, 7}
    copy(array5[0:], s7)
    // create an slice based on array5,
    // then we make the copy happen
    fmt.Println("array5:", array5)
    fmt.Println("s7:", s7)
}

func amazingSlice() {
    seatures := []string{
        "shark",
        "cuttlefish",
        "squid",
        "mantis shrimp",
        "aneone",
    }
    other := seatures[3:]
    other[0] = "other"
    other = append(other, "more")

    bther := append(other, "bmo", "bm1", "bm2", "bm3", "bm4")
    bther[1] = "bther"

    fmt.Println("Amazing slices:", seatures, other, bther)
}

/*
 user defined types, aka Struct
*/

func usingInlineStruct() {
    c := struct {
        Name string
        Type string
    }{
        Name: "Sammy",
        Type: "Jellyfish",
    }
    fmt.Println(c.Name, "the", c.Type)
}

type Creature struct {
    Name     string
    Type     string
    Greeting string
    password string
}

func (c Creature) String() string {
    return "<Name>" + c.Name + "<Type>" + c.Type
}

func (c Creature) Greet() Creature {
    fmt.Printf("%s says %s\n", c.Name, c.Greeting)
    return c
}

func (c Creature) SayGoodbye(name string) {
    fmt.Println("Farewell", name, "!")
}

func (c *Creature) UpdateName(name string) {
    c.Name = name
}

func logg(header string, s fmt.Stringer) {
    fmt.Println(header, ":", s)
}

func usingStruct() {
    c := Creature{
        Name:     "Sammy",
        Type:     "shark",
        Greeting: "Hello!",
        password: "secret",
    }
    fmt.Println(c.Name, "the", c.Type)
    fmt.Println("Password is", c.password)
    Creature.Greet(c)
    c.Greet()
    c.Greet().SayGoodbye("gophers")
    Creature.SayGoodbye(Creature.Greet(c), "gopherss")
    logg("creature in c", c)
    c.UpdateName("Sanny")
    logg("creature in c", c)
}

type Submersible interface {
    Dive()
}

type Shark struct {
    Name string `example:"name"`

    isUnderwarter bool
}

func (s Shark) String() string {
    if s.isUnderwarter {
        return fmt.Sprintf("%s is underwarter", s.Name)
    }
    return fmt.Sprintf("%s is on the surface", s.Name)
}

func (s *Shark) Dive() {
    s.isUnderwarter = true
}

func submerge(s Submersible) {
    s.Dive()
}

func usingInterface() {
    s := &Shark{
        Name: "Sammy",
    }

    fmt.Println(s)
    submerge(s)
    fmt.Println(s)
}

type User struct {
    Name          string    `json:"name"`
    Password      string    `json:"-"`                       // omitted by json encoding
    PreferredFish []string  `json:"preferredFish,omitempty"` // omitted only empty
    CreatedAt     time.Time `json:"createdAt"`
}

func mockUser() {
    u := &User{
        Name:      "Sammy the shark",
        Password:  "fisharegreat",
        CreatedAt: time.Now(),
    }
    if out, err := json.MarshalIndent(u, "", "  "); err != nil {
        log.Println(err)
    } else {
        fmt.Println(string(out))
    }
}

type Circle struct {
    Radius float64
}

func (c Circle) Area() float64 {
    return math.Pi * math.Pow(c.Radius, 2)
}

func (c Circle) String() string {
    return fmt.Sprintf("Circle {Radius: %.2f}", c.Radius)
}

type Square struct {
    Width  float64
    Height float64
}

func (s Square) Area() float64 {
    return s.Width * s.Height
}

func (s Square) String() string {
    return fmt.Sprintf("Square {Width: %.2f, Height: %.2f}", s.Width, s.Height)
}

type Sizer interface {
    Area() float64
}

type Shaper interface {
    Sizer
    fmt.Stringer
}

func Less(s1, s2 Sizer) Sizer {
    if s1.Area() < s2.Area() {
        return s1
    }
    return s2
}

func PrintArea(s Shaper) {
    fmt.Printf("area of %s is %.2f\n", s.String(), s.Area())
}

func usingSizer() {
    c := Circle{Radius: 10}
    s := Square{Height: 10, Width: 5}
    PrintArea(c)
    PrintArea(s)
    l := Less(c, s)
    fmt.Printf("%+v is the smaller\n", l)

    s = Square{Height: 100, Width: 5}
    l = Less(c, s)
    fmt.Printf("%+v is the smaller\n", l)
}
