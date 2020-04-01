def triangles():
    l = [1]
    while True:
        print('before yield ->', l) 
        yield l
        print('after yield ->', l) 
        l.append(0)
        print('after append ->', l) 
        l = [l[i-1] + l[i] for i in range(len(l))]
    return 'done' 
n = 0
for t in triangles():
    print(t)
    n = n + 1
    if n == 10: 
        break

