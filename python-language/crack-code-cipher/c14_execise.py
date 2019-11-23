from mod_libs import findGCD, findModInverse
SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890 !?.'
LEN = len(SYMBOLS)


def main():
    message = """"A computer would deserve to be
called intelligent if it could deceive a human into
believing that it was human."
 -Alan Turing"""
    key = 2894
    en = encrypt(key, message)

    print(en)
    de = decrypt(key, en)

    print(de)
    print(de == message)


def encrypt(key, text):
    ka, kb = splitKey(key)
    code = ''
    for c in text:
        ori = SYMBOLS.find(c)
        if ori > -1:
            code += SYMBOLS[(ori * ka + kb) % LEN]
        else:
            code += c
    return code


def decrypt(key, cipher):
    ka, kb = splitKey(key)
    text = ''
    mod = findModInverse(ka, LEN)
    for c in cipher:
        after = SYMBOLS.find(c)
        if after > -1:
            text += SYMBOLS[((after - kb) * mod) % LEN]
        else:
            text += c
    return text


def checkKeys(ka, kb):
    if ka == 1:
        sys.exit('Cipher is weak if KeyA is 1. Choose another key.')
    if kb == 0:
        sys.exit('Cipher is weak if KeyB is 0. Choose another key.')
    if ka < 0 or kb < 0 or kb > LEN-1:
        sys.exit('Key A must be greater than 0 and Key B must be between 0 and %s.' % (len(SYMBOLS) - 1))
    if findGCD(ka, LEN) != 1:
        sys.exit('Key A (%s) and the symbol set size (%s) are not relatively prime. Choose a different key.' % (keyA, len(SYMBOLS)))


def splitKey(key):
    ka = key // LEN
    kb = key - ka * LEN
    return (ka, kb)


if __name__ == "__main__":
    main()