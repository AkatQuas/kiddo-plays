// +build pro

package main
/*
this file would be build only if build with tags "pro"
// go build -tags pro
*/

func init() {
  features = append(features,
    "Pro Feature #1",
    "Pro Feature #2",
  )
}

