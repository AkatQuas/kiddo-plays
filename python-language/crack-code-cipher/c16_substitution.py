import random

LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'


def main():
    message = 'If a man is offered a fact which goes against his instincts, he will scrutinize it closely, and unless the evidence is overwhelming, he will refuse to believe it. If, on the other hand, he is offered something which affords a reason for acting in accordance to his instincts, he will accept it even on the slightest evidence. The origin of myths is explained in this way. -Bertrand Russell'

    for count in range(10):
        key = shuffle(LETTERS)
        if isKeyValid(key, LETTERS):
            en = encrypt(key, message)
            de = decrypt(key, en)
            print('\nUsing key: %s ' % key)
            print('\nEncrypt Text:\n %s ' % en)
            print('\nDecrypt Text:\n %s ' % de)
            print('\nDecrypt result: %s\n---' % (message == de))
        else:
            print('Invalid key %s ' % key)


def encrypt(key, text):
    code = ''
    for c in text:
        pos = LETTERS.find(c.upper())
        if pos > -1:
            if c.isupper():
                code += key[pos]
            else:
                code += key[pos].lower()
        else:
            code += c

    return code


def decrypt(key, cipher):
    code = ''
    for c in cipher:
        pos = key.find(c.upper())
        if pos > -1:
            if c.isupper():
                code += LETTERS[pos]
            else:
                code += LETTERS[pos].lower()
        else:
            code += c
    return code


def isKeyValid(key, text):
    keylist = list(key).sort()
    letterlist = list(text).sort()
    return keylist == letterlist


def shuffle(text):
    key = list(text)
    random.shuffle(key)
    return ''.join(key)


if __name__ == "__main__":
    main()
