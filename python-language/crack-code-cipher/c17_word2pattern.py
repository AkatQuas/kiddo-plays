import random, pprint
import json
LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
LEN = len(LETTERS)


def main():
    PATTERN = {}
    with open('dictionary.txt', 'r') as dicFile:
        for line in dicFile:
            text = line.strip()
            pattern = word2pattern(text)
            if pattern in PATTERN:
                PATTERN[pattern].append(text)
            else:
                PATTERN[pattern] = [text]

    with open('my_pattern.py', 'w') as file:
        file.write('PATTERNS = ')
        file.write(pprint.pformat(PATTERN))


def word2pattern(word):
    word = word.upper()
    nextNum = 0
    letters = {}
    pattern = []
    for c in word:
        if c not in letters:
            letters[c] = str(nextNum)
            nextNum += 1
        pattern.append(letters[c])
    return '.'.join(pattern)


def test():
    time = 10
    while time > 0:
        word = generateText()
        pattern = word2pattern(word)
        print('%s\n%s' % ('.'.join(word), pattern))
        time -= 1


def generateText():
    text = ''
    last = LEN - 1
    for c in range(6):
        pos = random.randint(0, last)
        text += LETTERS[pos]
    return text


if __name__ == "__main__":
    # test()
    main()
