import sympy as sy

x = sy.Symbol('x')
y = sy.Symbol('y')

a, b = sy.symbols('a b')
print(x,y,a,b)

# create a new symbol (not function)
f = x ** 2 + y ** 2 - 2 * x * y + 5

print(f)

# auto simplify
g = x**2 + 2 - 2*x + x**2 -1 
print(g)

print('Integration')
# single variable
f = sy.sin(x)+ sy.exp(x)

print(sy.integrate(f, (x, a,b)))
print(sy.integrate(f, (x, 1,2)))
print(sy.integrate(f, (x, 1.0,2.0)))

g = sy.exp(x) + x * sy.sin(y)
print(sy.integrate(g, (y,a,b))) 

print('Differentiation')
f = sy.cos(x) + x**x
print(sy.diff(f,x))
g = sy.cos(y)*x + sy.log(y)
print(sy.diff(g,y))
