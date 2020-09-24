// this code is derived from this blog, https://artem.krylysov.com/blog/2020/07/28/lets-build-a-full-text-search-engine/
package main

import (
    "encoding/xml"
    "fmt"
    "os"
    "regexp"
    "strings"
    "unicode"

    snowballeng "github.com/kljensen/snowball/english"
)

func main() {
    idx := make(index)
    idx.add([]document{{ID: 1, Text: "A document with a donut on a glass plate. Not only the donuts."}})
    idx.add([]document{{ID: 2, Text: "donut is a donut, nothing else"}})
    fmt.Println(idx)
}

//index is a struct to represent word-document indies
type index map[string][]int

func (idx index) add(docs []document) {
    for _, doc := range docs {
        for _, token := range analyze(doc.Text) {
            ids := idx[token]
            if ids != nil && ids[len(ids) -1] == doc.ID{
                continue
            }
            idx[token] = append(dis, doc.ID)
        }
    }
}

func (idx index) quickSearch(text string) [][]int {
    var r [][]int
    for _, token := range analyze(text) {
        if ids, ok := idx[token]; ok {
            r = append(r, ids)
        }
    }
    return r
}

// Boolean queries
func (idx index) search(text string) []int {
    var r []int
    for _, token := range analyze(text) {
        if ids, ok := idx[token]; ok {
            if r == nil {
                r = ids
            } else {
                r = intersection(r, ids)
            }
        } else {
            // Token doesn't exist
            // search next token
        }
    }
    return r
}

type document struct {
    Title string `xml:"title"`
    URL string `xml:"url"`
    Text string `xml:"abstract"`
    ID int
}

//loadDocument load text from disk to
// create Document struct
func loadDocument(path string) ([]document, error) {
    f, err := os.Open(path)
    if err != nil {
        return nil, err
    }
    defer f.Close()

    dec := xml.NewDecoder(f)

    dump := struct {
        Documents []document `xml:"doc"`
    }{}

    if err := dec.Decode(&dump); err != nil {
        return nil , err
    }

    docs := dump.Documents
    for i := range docs {
        docs[i].ID = i
    }
    return docs, nil
}

//search using regexp to search a term in documents
func search(docs []document, term string) []document {
    // Don't do this in production, it's a security risk. term needs to be sanitized.
    re := regexp.MustCompile(`(?i)\b`+term+`\b`)
    var r []document
    for _, doc := range docs {
        if re.MatchString(doc.Text) {
            r = append(r, doc)
        }
    }
    return r
}

func intersection(a []int, b []int) []int {
    maxLen := len(a)
    if len(b) > maxLen {
        maxLen = len(b)
    }
    r := make([]int, 0, maxLen)
    var i, j int
    for i < len(a) && j < len(b) {
        if a[i] < b [j] {
            i ++
        } else if a[i] > b[j] {
            j++
        } else {
            r = append(r, a[i])
            j++
            i++
        }
    }
    return r
}

// analyze text to some tokens
func analyze(text string) []string {
    tokens := tokenize(text)
    tokens = lowercaseFilter(tokens)
    tokens = stopwordFilter(tokens)
    return stemmerFilter(tokens)
}

//tokenize split text into words
func tokenize(text string) []string {
    return strings.FieldsFunc(text, func(r rune) bool {
        // Split on any character that is not a letter or a number.
        return !unicode.IsLetter(r) && !unicode.IsNumber(r)
    })
}

//lowercaseFilter make every token to lower case
func lowercaseFilter(tokens []string) []string {
    r := make([]string, len(tokens))
    for i, token := range tokens {
        r[i] = strings.ToLower(token)
    }
    return r
}

var stopwords = map[string]struct{}{ // I wish Go had built-in sets.
    "a": {}, "and": {}, "be": {}, "have": {}, "i": {},
    "in": {}, "of": {}, "that": {}, "the": {}, "to": {},
}

//stopwordFilter will drop some common stop words
func stopwordFilter(tokens []string) []string {
    r := make([]string, 0, len(tokens))
    for _, token := range tokens {
        if _, ok := stopwords[token]; !ok {
            r = append(r, token)
        }
    }
    return r
}

// stemmerFilter will stem token to its stem
func stemmerFilter(tokens []string) []string {
    r := make([]string, len(tokens))
    for i, token := range tokens {
        r[i] = snowballeng.Stem(token, false)
    }
    return r
}
