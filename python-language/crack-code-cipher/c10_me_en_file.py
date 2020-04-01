import os, random, sys, time

from c7_transposition import encrypt, decrypt

def main():
  inputFile = 'message.txt'
  outputFile ='message-me.en.txt'
  decryptFile = 'message-me.de.txt'

  key = 10

  if not os.path.exists(inputFile):
    print('The file %s dose not exist.' % (inputFile))
    sys.exit()

  fileObj = open(inputFile)
  content = fileObj.read()

  fileObj.close()

  startTime = time.time()
  translated = encrypt(key, content)
  totalTime = round(time.time() - startTime, 2)

  outObj = open(outputFile, 'w')
  outObj.write(translated)
  outObj.close()

  fileEn = open(outputFile)
  content = fileEn.read()
  fileEn.close()
  decryptText = decrypt(key, content, len(content))

  outObj = open(decryptFile, 'w')
  outObj.write(decryptText)
  outObj.close()

if __name__ == "__main__":
    main()