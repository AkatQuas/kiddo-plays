from math import ceil

from transpositionDecrypt import decryptMessage
from transpositionEncrypt import encryptMessage

T1 = 'H cb  irhdeuousBdi   prrtyevdgp nir  eerit eatoreechadihf pak en ge b te dih aoa .da tts tn'
T2 = 'A b  drottthawa nwar eci t nlel ktShw leec,hheat  .na  e soog mah a  ateniAcgakh dmnor  '
T3 = 'Bmmsrl dpnaua!toeboo’ktn uknrwos . yaregonr w nd,tu  oiady h gtRwt   A hhanhhasthtev  e t e  eo'

def encrypt(key, code):
    l = len(code)
    row = ceil(l / key)
    ciper = ''
    ids = []
    for i in range(key):
        idx = i
        while idx < l:
            ciper += code[idx]
            idx += key
    print(set(ids), len(ids))
    return ciper


def decrypt(key, ciper, l):
    code = ''
    row = ceil(l / key)
    m =  l % key
    for i in range(row-1):
        for j in range(key):
            compliment = j - m if j >= m else 0
            idx = i + j * row - compliment
            if idx < l:
                code += ciper[idx]
    for j in range(m):
        idx = row - 1 + j * row
        if idx < l:
            code += ciper[idx]

    return code


def dec2(key, ciper, l):
    l = len(ciper)
    cols = ceil(l / key)
    rows = key
    sb = cols * rows - l

    pt = [''] * cols

    c = 0
    r = 0
    for s in ciper:
        pt[c] += s
        c += 1
        if (c == cols) or (c == cols -1 and r >= rows - sb ):
            c = 0
            r += 1
    return ''.join(pt)

def main():
    PLAINTEXT = 'Common sense is not so common.'
    for key in range(4, 10):
        en = encrypt(key, PLAINTEXT)
        print(key, ': encrypt -> ', en)

        de = dec2(key, en, len(PLAINTEXT))
        print(key, ': decrypt -> ', de)
        print('---')

    for i in range(1,15):
      print(i, decrypt(i, T1, 89))
      print(i, decrypt(i, T2, 86))
      print(i, decrypt(i, T3, 93))
      print('---')


def main2():
    PLAINTEXT = 'Common sense is not so common.'
    for key in range(4, 10):
        en = encryptMessage(key, PLAINTEXT)
        print(key, ': encrypt -> ', en)

        de = decryptMessage(key, en)
        print(key, ': decrypt -> ', de)
        print('---')
    for i in range(1,15):
      print(i, decryptMessage(i, T1))
      print(i, decryptMessage(i, T2))
      print(i, decryptMessage(i, T3))
      print('---')

def main3():
    for i in range(1,15):
      print(i, 'lib ->', decryptMessage(i, T1))
      print(i, 'me ->', decrypt(i, T1, 89))
      print(i, 'lib ->', decryptMessage(i, T2))
      print(i, 'me ->', decrypt(i, T2, 86))
      print(i, 'lib ->', decryptMessage(i, T3))
      print(i, 'me ->', decrypt(i, T3, 93))
      print('---')


if __name__ == "__main__":
    # main()
    # main2()
    main3()