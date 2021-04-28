package dictionary

func Search(dictionary map[string]string, key string) string {
	return dictionary[key]
}

// A map value is a pointer to a runtime.hmap structure.

type DictionaryErr string

func (e DictionaryErr) Error() string {
	return string(e)
}

type Dictionary map[string]string

const (
	ErrNotFound   = DictionaryErr("no word found")
	ErrWordExists = DictionaryErr("word already exists")
)

func (d Dictionary) Search(word string) (string, error) {
	definition, ok := d[word]
	if !ok {
		return "", ErrNotFound
	}
	return definition, nil
}

func (d Dictionary) Add(word, definition string) error {
	_, err := d.Search(word)
	switch err {
	case ErrNotFound:
		d[word] = definition
	case nil:
		return ErrWordExists
	default:
		return err
	}
	return nil
}

func (d Dictionary) Update(word, definition string) error {
	_, err := d.Search(word)
	switch err {
	case nil:
		d[word] = definition
	default:
		return err
	}
	return nil
}

func (d Dictionary) Delete(word string) {
	delete(d, word)
}
