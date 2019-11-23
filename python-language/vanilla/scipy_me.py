import numpy as np
from scipy import linalg,integrate, stats, optimize
from matplotlib import pyplot as plt

def p_stars(msg =''):
    print('*'*10,msg,'*'*10)

p_stars('linear algebra')

A = np.random.randn(5,5)
b = np.random.randn(5)
print('\nA\n',A)
print('\nb\n',b)

x = linalg.solve(A, b) # A x = b
print(x)

eigen = linalg.eig(A)
print('eigenvalues and eigenvectors\n',eigen)

det = linalg.det(A)
print('determinant ',det)

p_stars('numberical integration')
def log_fun(x):
    return np.log(x)

value, error = integrate.quad(log_fun, 0, 1)
print('value ', value)
print('error ', error)

p_stars('optimisation: data fitting')

def myfun1(x, a, b ,c):
    return a * np.exp(-b * x) + c

xdata = np.linspace(0,4,50)
y = myfun1(xdata, 2.5, 1.3, 0.5)
ydata = y + 0.2 * np.random.normal(size = len(xdata))
popt, pcov = optimize.curve_fit(myfun1, xdata, ydata)
plt.plot(xdata, ydata, 'b*')
plt.plot(xdata, myfun1(xdata, popt[0], popt[1],popt[2]), 'r-')
plt.title('$f(x) = a e^{-bx} +c$ curve fitting')
want_show = input('want to show plot? y/N')
if want_show == 'y':
    plt.show()

p_stars('optimisation: root searching')

def fun2(x):
    return np.exp(np.exp(x)) - x ** 2

print('find zero of fun2 with initial point 0 by Newton-Raphson') 
print(optimize.newton(fun2, 0))

print('find zero between (-5,5) by bisection')
print(optimize.bisect(fun2, -5, 5))

