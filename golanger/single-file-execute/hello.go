package main

import (
    "fmt"
    "strings"
    "unicode/utf8"
)

var g = "global"

const (
    gShark   = "Sammy Shark"
    timing   = 0.14
    leapYear = int(366)
)

func printLocal() {
    g := g + "->local"
    fmt.Println(g)
}

func main() {
    // Print "hello, World!" to console
    fmt.Println("Hello, world")

    a := `Say "hello" \n  to Go!`
    b := "Say \n \"Hello\" \n   to Go!"
    longString := `This string is
  on multiple lines
  and .`
    fmt.Println(a)
    fmt.Println("UPPERCASE -> ", strings.ToUpper(a))
    fmt.Println(b)
    fmt.Println("lowercase -> ", strings.ToLower(b))
    fmt.Println(longString)

    fmt.Println("Sammy" + "Shark")

    he := "Hello ,世界"

    for i, c := range he {
        fmt.Printf("%d: %s\n", i, string(c))
    }

    fmt.Printf("length of %s: %d\n", he, len(he))
    eh := "Hello  `fmt`   package"
    fmt.Println(eh)
    fmt.Printf("'%s' has prefix \"He\"? %t\n", eh, strings.HasPrefix(eh, "He"))
    fmt.Printf("'%s' has prefix \"shark\"? %t\n", eh, strings.HasSuffix(eh, "shark"))
    fmt.Printf("'%s' contains \"fmt\"? %t\n", eh, strings.Contains(eh, "fmt"))
    fmt.Printf("'%s' contains \"a\" for %d times\n", eh, strings.Count(eh, "a"))
    fmt.Printf("%q\n", strings.Split(eh, " "))
    fmt.Printf("%q\n", strings.Fields(eh))
    fmt.Println(strings.ReplaceAll(eh, "fmt", "strings"))

    coral := [3]string{"blue coral", "staghorn coral", "pillar coral"}
    fmt.Println(coral)
    fmt.Println(strings.Join([]string{"only slice of string works", "shark", "cuttlefish", "square"}, ";"))

    seaCreatures := []string{"shark", "cuttlefish", "square", "1.0"}
    fmt.Println(seaCreatures)
    seaCreatures = append(seaCreatures, "seahorse")
    fmt.Println("After append seahores")
    fmt.Println(seaCreatures)

    person := map[string]string{
        "name":   "Sammy",
        "animal": "shark",
        "age":    "3",
        "color":  "red"}
    fmt.Println(person)
    fmt.Printf("person has color: %s\n", person["color"])

    printLocal()
    fmt.Println(g)
    fmt.Println(gShark)
    fmt.Println(timing)
    fmt.Println(leapYear)

    fmt.Printf("%v is a %[1]T\n", "literal string")
    fmt.Printf("%v is a %[1]T\n", `raw string literal`)

    usingRune()
    usingSpanish()
    usingCustomeType()
    fmt.Printf("%T, %[1]v\n", printLocal)
}

func usingRune() {
    var pi rune = 960
    var alpha rune = 940
    var omega rune = 969
    var bang byte = 33
    fmt.Printf("%v %v %v %v\n", pi, alpha, omega, bang)
    fmt.Printf("%c %c %c %c\n", pi, alpha, omega, bang)
    fmt.Printf("%b %b %b %b\n", pi, alpha, omega, bang)
    fmt.Println(string(pi), string(alpha), string(omega), string(bang))

    var star byte = '*'
    fmt.Printf("%c %[1]v\n", star)
    smile := '😅'
    fmt.Printf("%c %[1]v\n", smile)
    acute := 'é'
    fmt.Printf("%c %[1]v\n", acute)

    const r1 = '€'
	fmt.Println("(int32) r1:", r1)
	fmt.Printf("(HEX) r1: %x\n", r1)
	fmt.Printf("(as a String) r1: %s\n", r1)
	fmt.Printf("(as a character) r1: %c\n", r1)

	fmt.Println("A string is a collection of runes:", []byte("Mihalis"))
	aString := []byte("Mihalis")
	for x, y := range aString {
		fmt.Println(x, y)
		fmt.Printf("Char: %c\n", aString[x])
	}
	fmt.Printf("%s\n", aString)
}

func usingSpanish() {
    question := "¿Cómo estás?"

    fmt.Println(len(question), "bytes")
    fmt.Println(utf8.RuneCountInString(question), "runes")

    c, size := utf8.DecodeRuneInString(question)
    fmt.Printf("First rune: %c %v bytes\n", c, size)

    for i, ci := range question {
        fmt.Printf("%v %c\n", i, ci)
    }
}

type celsius float64

type kelvin float64

type fahrenheit float64

func (c celsius) kelvin() kelvin {
    return kelvin(c + 273.15)
}

func (k kelvin) celsius() celsius {
    return celsius(k - 273.15)
}

func (f fahrenheit) celsius() celsius {
    return celsius((f - 32.0) * 5.0 / 9.0)
}

func kelvinToCelsius(k kelvin) celsius {
    return celsius(k - 273.15)
}

func celsiusToKelvin(c celsius) kelvin {
    return kelvin(c + 273.15)
}

func usingCustomeType() {
    var temperature celsius = 20
    fmt.Println("temperature", temperature)

    const degrees = 20
    temperature += degrees
    fmt.Println("temperature", temperature)

    warmUp := 10
    temperature += celsius(warmUp)
    fmt.Println("temperature", temperature)

    var k kelvin = 294.0
    c := kelvinToCelsius(k)
    fmt.Println(k, "°K is ", c, "°C")

    c = celsius(127.0)
    k = celsiusToKelvin(c)
    fmt.Println(c, "°C is ", k, "°K")
}
