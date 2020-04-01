import numpy as np
from matplotlib import pyplot as plt
from scipy.stats import norm

def p_stars(msg = ''):
    print('*'*10, msg, '*'*10)

x = np.linspace(0, 10, 201)

plt.figure(figsize = (3,3))
plt.plot(x, x**0.3, 'r--') # red dashed
plt.plot(x, x-1,'k-') # continue plot
plt.plot(x, np.zeros_like(x), 'k-')

if input('show basic example plot? y/N\n') == 'y':
    plt.show()
plt.clf() 


for n in range(2,5):
    y = x ** (1/n)
    plt.plot(x,y,label ='x^(1/'+str(n)+')')

plt.legend(loc = 'best')
plt.xlabel('X no axis')
plt.ylabel('Y not axis')
plt.xlim(-2,10)
plt.title('new title with multi-plot', fontsize = 18)


if input('show multi-plot example plot? y/N\n') == 'y':
    plt.show()
plt.clf()


def pffcall(S,K):
    return np.maximum(S - K , 0.0)
def pffput(S,K):
    return np.maximum(K-S, 0.0)

S = np.linspace(50,151, 100)
fig = plt.figure(1,figsize = (12,6))
sub1 = fig.add_subplot(121) # col, row, num
sub1.set_title('Call', fontsize = 18)
plt.plot(S, pffcall(S, 100), 'r-', lw = 4)
plt.plot(S, np.zeros_like(S), 'black', lw = 1)
sub1.grid(True)
sub1.set_xlim([60, 120])
sub1.set_ylim([-10, 40])

sub2 = fig.add_subplot(122) # col, row, num
sub2.set_title('Put', fontsize = 18)
plt.plot(S, pffput(S, 100), 'r-', lw = 4)
plt.plot(S, np.zeros_like(S), 'black', lw = 1)
sub2.grid(True)
sub2.set_xlim([60, 120])
sub2.set_ylim([-10, 40])

if input('show sub-plot example plot? y/N\n') == 'y':
    plt.show()
plt.clf() 
plt.close(1)

def twocall(S, K =100, T =0.5, vol = 0.6, r = 0.05):
    d1 = (np.log(S/K) + (r + 0.5 * vol**2) * T) / np.sqrt(T) / vol
    d2 = (np.log(S/K) + (r - 0.5 * vol**2) * T) / np.sqrt(T) / vol
    return S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)

def twodelta(S, K =100, T =0.5, vol = 0.6, r = 0.05):
    d1 = (np.log(S/K) + (r + 0.5 * vol**2) * T) / np.sqrt(T) / vol
    return norm.cdf(d1)

S = np.linspace(40, 161, 100)
fig = plt.figure(2,figsize = ( 7,6))
ax = fig.add_subplot(111)
plt.plot(S, (twocall(S) - twocall(100)), 'r', lw= 1)
plt.plot(100,0, 'ro',lw=1)
plt.plot(S, np.zeros_like(S), 'black', lw =1 )
plt.plot(S, twocall(S) - twodelta(100)*S - (twocall(100) - twodelta(100)*100), 'y',  lw =1)
ax.annotate('$\Delta $ hedge', xy = (100,0), xytext=(110, -10), arrowprops = dict(headwidth =3, width = 0.5,facecolor = 'black', shrink = 0.05))
ax.annotate('Original call', xy = (120,twocall(120)-twocall(100)), xytext=(130, twocall(120)-twocall(100)), arrowprops = dict(headwidth =10, width = 3,facecolor = 'cyan', shrink = 0.05))
plt.grid(True)
plt.xlim(40, 160)
plt.xlabel('Stock price', fontsize= 18)
plt.ylabel('Profits', fontsize= 18)

if input('show annotate example plot? y/N\n') == 'y':
    plt.show()
plt.clf()
plt.close(2)
