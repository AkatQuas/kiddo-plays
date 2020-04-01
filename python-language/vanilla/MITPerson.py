class Person(object):
    def __init__(self,name):
        self.__name = name
    def getName(self):
        return self.__name

class MITPerson(Person):
    nextIdNum = 0 #next ID number to assign

    def __init__(self,name):
        Person.__init__(self,name)
        self.__idNum = MITPerson.nextIdNum
        MITPerson.nextIdNum += 1

    def getIdNum(self):
        return self.__idNum

    del __lt__(self, other):
        return self.__idNum < other.__idNum
