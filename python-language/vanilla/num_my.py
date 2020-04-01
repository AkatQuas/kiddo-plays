import numpy as np
import os

def p_stars(msg = ''):
    print('\n','*'*10, msg, '*'*10)

def printShape(a):
    print('target shape: ', a.shape)

p_stars('reshape the array') 
a = np.arange(0,20,1)

print('a', a)

b = a.reshape((4,5))

c = a.reshape((20,1))
printShape(a)

print('c', c)
printShape(b)

printShape(c) 


p_stars('transpose and dot')

a = np.array([1,2,3,4,5])
b = a.copy()

c1 = np.dot(np.transpose(a), b)
print(c1)
c2 = np.dot(a, np.transpose(b))
print(c2)

ax = a.reshape((5,1))
bx = b.reshape((1,5))

print('a', a)
print('a transpose', np.transpose(a))

c = ax.dot(bx)
print(c)
p_stars()

a = np.array([5,4,3,2,1])
print(a[1:4])
print(a)

p_stars('index and slicing')
a = np.arange(72) 
a.shape = (6,12)
print(a[1::2, ::2])
print(a)

p_stars('matrix dot multiplication')

x = np.array([10,20])
a = np.array([[1,2],[3,4]])

print('a', a, '\nx',x)
print('np.dot(a,x)', np.dot(a,x))
print('np.dot(x,a)', np.dot(x,a))

p_stars('save to files')

txt_file = './test1.txt'

if not os.path.exists(txt_file):
    print(txt_file,' not exist')
    np.savetxt('test1.txt',a)
else:
    print(txt_file, ' exist')

