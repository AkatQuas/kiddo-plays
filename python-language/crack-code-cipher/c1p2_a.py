from alphabet import ALPHABET;

def encrypt(key, code):
  code = code.upper()
  l = len(ALPHABET)
  ciper = ''
  for char in code:
    before = ALPHABET.find(char)
    if before > -1:
      after = before + key
      if after >= l:
        after -= l
      ciper += ALPHABET[after]
    else:
      ciper += char
  return ciper

def decrypt(key, ciper):
  code = ''
  ciper = ciper.upper()
  l = len(ALPHABET)
  for char in ciper:
    after = ALPHABET.find(char)
    if after > -1:
      before = after - key
      if before < 0:
        before += l
      code += ALPHABET[before]
    else:
      code += char
  return code

def main():
  text1 = 'ZXAI: P RDHIJBT HDBTIXBTH LDGC QN HRDIRWBTC XC PBTGXRP PCS PBTGXRPCH XC HRDIAPCS .';
  print(decrypt(15, text1))

  text2 = 'MQTSWXSV: E VMZEP EWTMVERX XS TYFPMG LSRSVW.'
  print(decrypt(4, text2))

  code1 = 'UMMSVMAA: Cvkwuuwv xibqmvkm qv xtivvqvo i zmdmvom bpib qa ewzbp epqtm .'

  en = encrypt(8, code1)
  de = decrypt(9, en)
  print(en, '\n', de)


if __name__ == "__main__":
  main()