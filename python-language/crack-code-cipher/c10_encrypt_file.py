import os, random, sys, time

from transpositionDecrypt import decryptMessage
from transpositionEncrypt import encryptMessage

def main():
  inputFile = 'message.txt'
  outputFile ='message.en.txt'
  decryptFile = 'message.de.txt'

  key = 10

  if not os.path.exists(inputFile):
    print('The file %s dose not exist.' % (inputFile))
    sys.exit()

  fileObj = open(inputFile)
  content = fileObj.read()

  fileObj.close()

  startTime = time.time()
  translated = encryptMessage(key, content)
  totalTime = round(time.time() - startTime, 2)

  outObj = open(outputFile, 'w')
  outObj.write(translated)
  outObj.close()

  fileEn = open(outputFile)
  content = fileEn.read()
  fileEn.close()
  decrypt = decryptMessage(key, content)

  outObj = open(decryptFile, 'w')
  outObj.write(decrypt)
  outObj.close()

if __name__ == "__main__":
    main()