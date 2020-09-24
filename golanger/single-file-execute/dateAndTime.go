package main

import (
    "bufio"
    "fmt"
    "io"
    "os"
    "regexp"
    "strings"
    "time"
)

func main() {
    usingTime()
    findDate()
    parseTime()
    parseDate()
    changeDateTime()
}

func findDate() {
    logs := []string{"127.0.0.1 - - [16/Nov/2017:10:49:46 +0200] 325504",
        "127.0.0.1 - - [16/Nov/2017:10:16:41 +0200] \"GET /CVEN HTTP/1.1\" 200 12531 \"-\" \"Mozilla/5.0 AppleWebKit/537.36",
        "127.0.0.1 200 9412 - - [12/Nov/2017:06:26:05 +0200] \"GET \"http://www.mtsoukalos.eu/taxonomy/term/47\" 1507",
        "[12/Nov/2017:16:27:21 +0300]",
        "[12/Nov/2017:20:88:21 +0200]",
        "[12/Nov/2017:20:21 +0200]",
    }

    for _, logEntry := range logs {
        r := regexp.MustCompile(`.*\[(\d\d/\w+/\d\d\d\d:\d\d:\d\d:\d\d.*)].*`)
        if r.MatchString(logEntry) {
            match := r.FindStringSubmatch(logEntry)
            dt, err := time.Parse("02/Jan/2006:15:04:05 -0700", match[1])
            if err == nil {
                newFormat := dt.Format(time.RFC850)
                fmt.Println(newFormat)
            } else {
                fmt.Println("Not a valid date time format!")
            }
        } else {
            fmt.Println("Not a match!")
        }
    }
}

func usingTime() {
    fmt.Println("Epoch time:", time.Now().Unix())
    t := time.Now()
    fmt.Println(t, t.Format(time.RFC3339))
    fmt.Println(t.Weekday(), t.Day(), t.Month(), t.Year())

    time.Sleep(time.Second)
    t1 := time.Now()
    fmt.Println("Time difference:", t1.Sub(t))

    formatT := t.Format("01 January 2006")
    fmt.Println(formatT)
    loc, _ := time.LoadLocation("Europe/Paris")
    londonTime := t.In(loc)
    fmt.Println("Paris:", londonTime)
}

func parseTime()  {
    var myTime string = "12:04"

    d, err := time.Parse("15:04", myTime)
    if err == nil {
        fmt.Println("Full:", d)
        fmt.Println("Time:", d.Hour(), d.Minute())
    } else {
        fmt.Println(err)
    }
}

func parseDate() {
    var myDate string = "20 July 2020"

    d, err := time.Parse("02 January 2006", myDate)
    if err == nil {
        fmt.Println("Full:", d)
        fmt.Println("Time:", d.Day(), d.Month(), d.Year())
    } else {
        fmt.Println(err)
    }
}

func changeDateTime() {
	filename := "logEntries.txt"
	f, err := os.Open(filename)
	if err != nil {
		fmt.Printf("error opening file %s", err)
		os.Exit(1)
	}
	defer f.Close()

	notAMatch := 0
	r := bufio.NewReader(f)
	for {
		line, err := r.ReadString('\n')
		if err == io.EOF {
			break
		} else if err != nil {
			fmt.Printf("error reading file %s", err)
		}

		r1 := regexp.MustCompile(`.*\[(\d\d\/\w+/\d\d\d\d:\d\d:\d\d:\d\d.*)\] .*`)
		if r1.MatchString(line) {
			match := r1.FindStringSubmatch(line)
			d1, err := time.Parse("02/Jan/2006:15:04:05 -0700", match[1])
			if err == nil {
				newFormat := d1.Format(time.Stamp)
				fmt.Print(strings.Replace(line, match[1], newFormat, 1))
			} else {
				notAMatch++
			}
			continue
		}

		r2 := regexp.MustCompile(`.*\[(\w+\-\d\d-\d\d:\d\d:\d\d:\d\d.*)\] .*`)
		if r2.MatchString(line) {
			match := r2.FindStringSubmatch(line)
			d1, err := time.Parse("Jan-02-06:15:04:05 -0700", match[1])
			if err == nil {
				newFormat := d1.Format(time.Stamp)
				fmt.Print(strings.Replace(line, match[1], newFormat, 1))
			} else {
				notAMatch++
			}
			continue
		}
	}
	fmt.Println(notAMatch, "lines did not match!")
}
