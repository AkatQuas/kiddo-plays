package iteration

func Repeat(char string, repeat int) string {
	var repeated string
	for i := 0; i < repeat; i++ {
		repeated += char
	}

	return repeated
}
