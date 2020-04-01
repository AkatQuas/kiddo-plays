
def reverseText(text):
  code = ''
  l = len(text) - 1
  while l >= 0:
    code += text[l]
    l -= 1
  return code


def main():
  text = 'Hello, World!'
  print(reverseText(text))
  text2 = '.syas ti tahw tuo erugif llits ylbaborp nac uoy ,detpyrcne si siht hguoht neve ,elpmaxe roF'
  print(reverseText(text2))

if __name__ == "__main__":
  # main()
  x ='aoeub'.find(':')
  print(x)