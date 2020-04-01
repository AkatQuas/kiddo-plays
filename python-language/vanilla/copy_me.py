import copy 
temp = [0,1,2,[3,4]]
test = temp

testC = copy.copy(temp)

testDeep = copy.deepcopy(temp)

temp.append('sign by temp')
print(temp ,'\n', test,'\n', testC ,'\n', testDeep)
test.append('sign by test')
print(temp ,'\n', test,'\n', testC ,'\n', testDeep)

test[2]='change by test'
print(temp ,'\n', test,'\n', testC ,'\n', testDeep)
test[3].append('inner append by test')
print(temp ,'\n', test,'\n', testC ,'\n', testDeep)
