import json

class Screen(object):
    @property
    def width(self):
        return self._width
    @width.setter
    def width(self, value):
        self._width = value
    @property
    def height(self):
        return self._height
    @height.setter
    def height(self, value):
        self._height = value
    @property
    def resolution(self):
        return 'resolution = ' + str(self._width * self._height)

s = Screen()
s.width = 1024
s.height = 768
print(s.resolution)

with open('./circle.py','r') as f:
    print( f.read() )

obj = dict(name='我的', age = 20)
s = json.dumps(obj, ensure_ascii = True)

print(s)

words = ['cat', 'window', 'defenestrate']

index = 0
for w in words[:]: 
    index = index + 1
    if len(w) > 6:
        words.insert(0,w)
        print(words)

for n in range(2, 10):
    for x in range(2,n):
        if n % x == 0:
            print(n, 'equals ',x ,' * ', n //x )
            break;
    else: 
        print(n , ' is a prime')

pairs = [(1, 'one'), (2, 'two'), (3, 'three'), (4, 'four')]
pairs.sort(key=lambda pair: pair[1])
print(pairs)

print('ok' if True else 'false')
print('ok' if False else 'false')


