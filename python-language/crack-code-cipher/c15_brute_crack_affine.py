
import c14_execise
import detectEnglish
import mod_libs


def main():
    cipher = """5QG9ol3La6QI93!xQxaia6faQL9QdaQG1!!axQARLa!!AuaRLQADQALQG93!xQxaGaAfaQ1QX3o1RQARL9Qda!AafARuQLX1LQALQI1iQX3o1RN"Q-5!1RQP36ARu"""
    hacked = hackAffine(cipher)
    if hacked != None:
        print('\nHacked done\n\n')
        for text in hacked:
            print('Possible result: \n %s ' % text)
    else:
        print('Failed to hack %s ' % cipher)


def hackAffine(cipher):
    LEN = len(c14_execise.SYMBOLS)
    poss = []
    for key in range(LEN ** 2):
        ka = c14_execise.splitKey(key)[0]
        if mod_libs.findGCD(ka, LEN) != 1:
            continue
        decryptedText = c14_execise.decrypt(key, cipher)
        print('Tried key %s ...(%s)' % (key, decryptedText))

        if detectEnglish.isEnglish(decryptedText):
            print('---\nPossible encryption hack:')
            print('Key: %s ' % (key))
            print('Decrypted message: ' + decryptedText[:200])
            print('\n---')
            poss.append({'key': key, 'text': decryptedText})
    if len(poss) > 0:
        return poss
    else:
        return None


if __name__ == "__main__":
    main()
