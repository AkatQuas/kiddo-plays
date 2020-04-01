class Ball:
    def __init__(self, color, size, direction):
        self.color = color
        self.size = size
        self.direction = direction
    
    def __str__(self):
        msg = 'Hi, a ' + self.size + ' ' + self.color + ' ball!'
        return msg

    def bounce(self):
        self.direction = 'up' if self.direction == 'down' else 'down'

class HotDog:
    def __init__(self):
        self.level = 0
        self.status = 'raw'
        self.condiments = []

    def __str__(self):
        msg = 'hot dog'
        if len(self.condiments) > 0:
            msg += ' with '
            for i in self.condiments:
                msg = msg + i + ', '

        msg = msg.strip(', ')
        msg = 'A ' + self.status + ' ' + msg + '.'
        return msg
        
    def cook(self, time):
        self.level += time
        if self.level > 8:
            self.status = 'charcoal'
        elif self.level > 5:
            self.status = 'well-done'
        elif self.level > 3:
            self.status = 'medium'
        else:
            self.status = 'raw'
    def addCondiment(self, condiment):
        self.condiments.append(condiment)

class GameObject:
    def __init__(self,name):
        self.name = name
    def pickUp(self, player):
        pass

class Coin(GameObject):
    def __init__(self, value):
        GameObject.__init__(self, 'coin')
        self.value = value
    def spend(self, buyer, seller):
        pass

def main():
    ball = Ball('red', 'small', 'down')
    print(ball)
    ball.bounce()
    print('bounce ', ball.direction)
    ball.bounce()
    print('bounce ', ball.direction)
    print('------')
    hotdog = HotDog()
    hotdog.cook(2)
    print(hotdog)
    hotdog.cook(2)
    print(hotdog)
    hotdog.cook(2)
    print(hotdog)
    hotdog.cook(4)
    print(hotdog)
    hotdog.addCondiment('ketchup')
    print(hotdog)
    hotdog.addCondiment('mustard')
    print(hotdog)

if __name__ == '__main__':
    main()