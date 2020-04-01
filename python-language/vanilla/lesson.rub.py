import urllib.request
import easygui
import random

def main():
    letters = ['a', 'b','c','d']
    letters.pop(2)
    print(letters)
    del letters[0]
    print(letters)
    age = 10
    name = 'mack'
    print('My name is %s , aged %d' % (name , age))

def main7():
    for looper in [1,2,3,4]:
        print('hello ', looper)
    for i in range(1, 5):
        print('range ', i)
    num = int(input('how many stars do you want? '))
    for i in range(0, num):
        print('* '* i, i)
    print('-----')
    for i in range(num, -1, -1):
        print('* '* i, i)

def main6(): 
    age = 10
    if 8 < age < 12:
        print(1 < 2 or 4< 3)

def main5(): 
    secret = random.randint(1, 99)
    guess = 0
    tries = 0

    easygui.msgbox(""" Ahoy! Guess the secret which is 
    an integer ranging from 1 to 99. 
    You have 6 tries. """)
    while guess != secret and tries < 6:
        guess = easygui.integerbox('What is your guess')
        if not guess: break
        if guess < secret: 
            easygui.msgbox(str(guess) + ' is too low')
        elif guess > secret:
            easygui.msgbox(str(guess)+ ' is too high')
        tries += 1
    
    if guess == secret:
        easygui.msgbox('Avast! you are right')
    else:
        easygui.msgbox('No more guesses ! Better luck next time!')
        


def main4():
    flavor = easygui.buttonbox('what is your favorite ice cream flavor?', choices = ['vanialla','chocolate','strawberry'])
    easygui.msgbox('you picked ' + flavor)
    flavor2 = easygui.choicebox('what is your favorite ice cream flavor?', choices = ['vanialla','chocolate','strawberry'])
    easygui.msgbox('you chose ' + flavor2)
    flavor3 = easygui.enterbox('what is your favorite ice cream flavor?', default = 'Vanilla')
    easygui.msgbox('you entered ' + flavor3)

def main2():
    sb = input('your name: ')
    print('hh', sb)

def main3():
    file = urllib.request.urlopen('http://helloworldbook.com/data/message.txt')
    message = file.read()
    print(message)



if __name__ == '__main__':
    main()