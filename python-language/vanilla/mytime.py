import timeit

def func1(x,y):
    return x ** 2 + y ** 3

t_s = timeit.default_timer()

print('t_s', t_s)
z = func1(103.2, 334.1)

t_e = timeit.default_timer()

cost = t_e - t_s

print(cost)
