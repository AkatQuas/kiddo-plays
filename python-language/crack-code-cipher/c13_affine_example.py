SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890 !?.'
LEN = len(SYMBOLS)

def encrypt(key, text):
  code = ''
  for t in text:
    ori = SYMBOLS.find(t)
    now = (key * ori) % LEN
    code += SYMBOLS[now]
  return code

def main():
  text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890 !?.'
  res1 = 'ARizCTk2EVm4GXo6IZq8Kbs0Mdu!Ofw.QhyBSj1DUl3FWn5HYp7Jar9Lct Nev?Pgx'
  en1 = encrypt(17, text)
  print(en1)
  print(res1 == en1)
  res2 = 'ALWhs4ALWhs4ALWhs4ALWhs4ALWhs4ALWhs4ALWhs4ALWhs4ALWhs4ALWhs4ALWhs4'
  en2 = encrypt(11, text)
  print(res2 == en2)



if __name__ == "__main__":
    main()