
def findGCD(a, b):
    while a != 0:
        a, b = b % a, a
    return b

def findModInverse(a, m):
    if findGCD(a, m) != 1:
        return None
    u1, u2, u3 = 1, 0, a
    v1, v2, v3 = 0, 1, m
    while v3 != 0:
        q = u3 // v3
        v1, v2, v3, u1, u2, u3 = (u1 - q * v1), (u2 - q * v2), (u3 - q * v3), v1, v2, v3
    return u1 % m

def test():
    print(8 == findGCD(24, 8))
    print(12 == findGCD(24, 36))
    print(5 == findModInverse(53, 66))


if __name__ == "__main__":
    test()
