
SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890 !?.'
LEN = len(SYMBOLS)

def decrypt(key, ciper):
  code = ''
  for char in ciper:
    idx = SYMBOLS.find(char)
    if idx > -1:
      ori = idx - key
      if ori < 0:
        ori += LEN
      code += SYMBOLS[ori]
    else:
      code += char
  return (key, code)

def main():
  message = 'guv6Jv6Jz!J6rp5r7Jzr66ntrM'
  for key in range(LEN):
    print(decrypt(key, message))

if __name__ == "__main__":
  main()