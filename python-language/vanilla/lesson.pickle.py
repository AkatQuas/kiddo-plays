import pickle

a1= 'apple'
b1 = { 1: 'One', 'two': '2'}
c1 = [ 'fee', 'fie']
f1 = open('temp.pkl','wb')
pickle.dump(a1,f1,True)
pickle.dump(b1,f1,True)
pickle.dump(c1,f1,True)
f1.close()