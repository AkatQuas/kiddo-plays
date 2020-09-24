package main

import (
    "fmt"
    "os"
    "reflect"
)

func main() {
    simpleReflectionExample()
    advancedReflectionExample()
}

func simpleReflectionExample() {
    type a struct {
        X int
        Y float64
        Z string
    }

    type b struct {
        F int
        G int
        H string
        I float64
    }
    // you can get the data type of advancedA variable using reflection.
    x := 100
    xRefl := reflect.ValueOf(&x).Elem()
    xType := xRefl.Type()
    fmt.Printf("The type of x is %s.\n", xType)
    // if all you care about is the data type of advancedA variable,
    // just simply call reflect.TypeOf(x) instead
    fmt.Printf("The type of x is %s using \"reflect.TypeOf\".\n", reflect.TypeOf(x))

    A := a{100, 200.12, "Struct advancedA"}
    B := b{1, 2, "Struct b", -1.2}
    var r reflect.Value

    arguments := os.Args
    if len(arguments) == 1 {
        r = reflect.ValueOf(&A).Elem()
    } else {
        r = reflect.ValueOf(&B).Elem()
    }

    iType := r.Type()
    fmt.Printf("i Type: %s\n", iType)
    fmt.Printf("The %d fields of %s are:\n", r.NumField(), iType)

    /*
       Use the appropriate functions of the `reflect` package in order to obtain the desired information.
       The `NumField()` method returns the number of fields in advancedA `reflect.Value` structure.
       The `Field()` function returns the field of the structure that is specified by its parameter.
       The `Interface()` function returns the value of advancedA field of the `reflect.Value` structure as an interface.
    */
    for i := 0; i < r.NumField(); i++ {
        fmt.Printf("Field name: %s ", iType.Field(i).Name)
        fmt.Printf("with type: %s ", r.Field(i).Type())
        fmt.Printf("and value %v\n", r.Field(i).Interface())
    }
}

type t1 int
type t2 int

type advancedA struct {
    X    int
    Y    float64
    Text string
}

// compareStruct uses Go code from reflection.go to perform its task.
func (a1 advancedA) compareStruct(a2 advancedA) bool {
    r1 := reflect.ValueOf(&a1).Elem()
    r2 := reflect.ValueOf(&a2).Elem()

    for i := 0; i < r1.NumField(); i++ {
        if r1.Field(i).Interface() != r2.Field(i).Interface() {
            return false
        }
    }
    return true
}

// printMethods can iterate the methods in the type i
func printMethods(i interface{}) {
    r := reflect.ValueOf(i)
    t := r.Type()
    fmt.Printf("Type to examine: %s\n", t)

    for j := 0; j < r.NumMethod(); j++ {
        m := r.Method(j).Type()
        fmt.Println(t.Method(j).Name, "-->", m)
    }
}

func advancedReflectionExample() {
    /*
    Although both t1 and t2 types are based on int
    and therefore are essentially the same type as int,
    Go treats them as totally different types.
    Their internal representation after Go parses the code of the program
    will be main.t1 and main.t2, respectively.
    */
    x1 := t1(100)
    x2 := t2(100)
    fmt.Printf("The type of x1 is %s\n", reflect.TypeOf(x1))
    fmt.Printf("The type of x2 is %s\n", reflect.TypeOf(x2))

    var p struct{}
    r := reflect.New(reflect.ValueOf(&p).Type()).Elem()
    fmt.Printf("The type of r is %s\n", reflect.TypeOf(r))

    a1 := advancedA{1, 2.1, "A1"}
    a2 := advancedA{1, -2, "A2"}

    if a1.compareStruct(a1) {
        fmt.Println("a1 is Equal to a1!")
    }

    if !a1.compareStruct(a2) {
        fmt.Println("a1 is Not Equal to a2!")
    }

    var f *os.File
    printMethods(f)
}
