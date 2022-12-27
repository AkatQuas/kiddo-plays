import hashlib, sys

def getMD5(Cap):
  for x in range(100000, 100000000):
    captcha = x
    MD5 = hashlib.md5(str(captcha).encode('utf-8')).hexdigest()
    if MD5[0:6] == Cap:
      return captcha

print(getMD5(sys.argv[1]))
