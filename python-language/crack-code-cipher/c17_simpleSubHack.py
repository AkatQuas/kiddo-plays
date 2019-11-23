import re
import pprint
import c17_word2pattern
import my_pattern
import copy
import simpleSubCipher

LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
MESSAGE = 'Sy l nlx sr pyyacao l ylwj eiswi upar lulsxrj isr sxrjsxwjr, ia esmm rwctjsxsza sj wmpramh, lxo txmarr jia aqsoaxwa sr pqaceiamnsxu, ia esmm caytra jp famsaqa sj. Sy, px jia pjiac ilxo, ia sr pyyacao rpnajisxu eiswi lyypcor l calrpx ypc lwjsxu sx lwwpcolxwa jp isr sxrjsxwjr, ia esmm lwwabj sj aqax px jia rmsuijarj aqsoaxwa. Jia pcsusx py nhjir sr agbmlsxao sx jisr elh. -Facjclxo Ctrramm'

nonLettersOrSpacePattern = re.compile('[^A-Z\s]')


def main():
    print('hacking...')
    letterMap = hackSimple(MESSAGE)

    print('Mapping:')
    print(letterMap)
    print('\nOriginal ciphertext:')
    print(MESSAGE)
    hacked = decryptWithCipherLetterMapping(MESSAGE, letterMap)
    print('\n', hacked)


def getBlankMapping():
    return {'A': [], 'B': [], 'C': [], 'D': [], 'E': [], 'F': [], 'G': [],
            'H': [], 'I': [], 'J': [], 'K': [], 'L': [], 'M': [], 'N': [], 'O': [], 'P': [], 'Q': [], 'R': [], 'S': [], 'T': [], 'U': [], 'V': [], 'W': [], 'X': [], 'Y': [], 'Z': []}


def addLettersToMapping(letterMapping, cipherword, candidate):
    for i in range(len(cipherword)):
        if candidate[i] not in letterMapping[cipherword[i]]:
            letterMapping[cipherword[i]].append(candidate[i])


def intersectMappings(mapA, mapB):
    intersect = getBlankMapping()
    for letter in LETTERS:
        if mapA[letter] == []:
            intersect[letter] = copy.deepcopy(mapB[letter])
        elif mapB[letter] == []:
            intersect[letter] = copy.deepcopy(mapA[letter])
        else:
            for mapped in mapA[letter]:
                if mapped in mapB[letter]:
                    intersect[letter].append(mapped)

    return intersect


def removeSolvedLettersFromMapping(letterMapping):
    loopAgain = True
    while loopAgain:
        loopAgain = False

        solved = []
        for cipherletter in LETTERS:
            if len(letterMapping[cipherletter]) == 1:
                solved.append(letterMapping[cipherletter][0])

        for cipherletter in LETTERS:
            for s in solved:
                if len(letterMapping[cipherletter]) != 1 and s in letterMapping[cipherletter]:
                    letterMapping[cipherletter].remove(s)
                    if len(letterMapping[cipherletter]) == 1:
                        loopAgain = True

    return letterMapping


def hackSimple(message):
    intersect = getBlankMapping()
    cipherwordlist = nonLettersOrSpacePattern.sub('', message.upper()).split()
    for cipherword in cipherwordlist:
        candidateMap = getBlankMapping()

        wordPattern = c17_word2pattern.word2pattern(cipherword)
        if wordPattern not in my_pattern.PATTERNS:
            continue
        for candidate in my_pattern.PATTERNS[wordPattern]:
            addLettersToMapping(candidateMap, cipherword, candidate)

        intersect = intersectMappings(intersect, candidateMap)

    return removeSolvedLettersFromMapping(intersect)


def decryptWithCipherLetterMapping(ciphertext, letterMapping):
    key = ['*'] * len(LETTERS)
    for letter in LETTERS:
        if len(letterMapping[letter]) == 1:
            keyIndex = LETTERS.find(letterMapping[letter][0])
            key[keyIndex] = letter
        else:
            ciphertext = ciphertext.replace(letter.lower(), '_')
            ciphertext = ciphertext.replace(letter.upper(), '_')
    key = ''.join(key)

    return simpleSubCipher.decryptMessage(key, ciphertext)

if __name__ == "__main__":
    main()
