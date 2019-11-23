import random
import sys
import os
import primeNum
import cryptomath


def main():
    print('Making key files...')
    makeKeyFiles('al_sweigart', 1024)
    print('Key files made.')


def generateKey(keySize):
    p = 0
    q = 0
    # Step1: create two prime numbers, p and q. calculate n = p * q:
    print('Generating p prime...')
    while p == q:
        p = primeNum.generateLargePrime(keySize)
        q = primeNum.generateLargePrime(keySize)
    n = p * q

    # Step2: Create a number e that is relatively prime to (p-1)*(q-1):
    print('Generating e that is relatively prime to (p-1)*(q-1)...')
    x = (p-1) * (q - 1)
    while True:
        e = random.randrange(2 ** (keySize - 1), 2 ** (keySize))
        if cryptomath.gcd(e, x) == 1:
            break

    # Step3: Calculate d, the mod inverse of e:
    print('Calculating d that is mod inverse of e...')
    d = cryptomath.findModInverse(e, x)

    publicKey = (n, e)
    privateKey = (n, d)

    print('Public Key:\n', publicKey)
    print('Private Key:\n', privateKey)

    return (publicKey, privateKey)


def makeKeyFiles(name, keySize):
    # Creates two files 'x_pubkey.txt' and 'x_privkey.txt' (where x
    # is the value in name) with the n,e and d,e integers written in
    # them, delimited by a comma.

    if os.path.exists('%s_pub.txt' % (name)) or os.path.exists('%s_pri.txt' % (name)):
        sys.exit('WARNING: The file % s_pubkey.txt or % s_privkey.txt already exists! Use a different name or delete these files and rerun this program.' % (name, name))
    publicKey, privateKey = generateKey(keySize)

    print()
    print('The public key is a %s and a %s digit number.' %
          (len(str(publicKey[0])), len(str(publicKey[1]))))
    print('Writing public key to file %s_pubkey.txt...' % (name))
    with open('%s_pubkey.txt' % (name), 'w') as fo:
        fo.write('%s,%s,%s' % (keySize, publicKey[0], publicKey[1]))

    print()
    print('The private key is a %s and a %s digit number.' %
          (len(str(publicKey[0])), len(str(publicKey[1]))))
    print('Writing private key to file %s_privkey.txt...' % (name))
    with open('%s_privkey.txt' % (name), 'w') as fo:
        fo.write('%s,%s,%s' % (keySize, privateKey[0], privateKey[1]))


if __name__ == "__main__":
    main()
