from PIL import Image
import argparse
import os
import re

ASCII_CHAR = list('$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\|()1{}[]?-_+~<>i!lI;:,\"^`') 

def rgb2char(r,g,b,alpha = 256):
    if alpha == 0:
        return ' '
    length = len(ASCII_CHAR)
    gray = int(0.2126 * r + 0.7152 * g + 0.0722 *b)
    unit = int(gray / ((256.0 + 1) /length))
    return ASCII_CHAR[unit]

def img2char(image_path, width=100, height=100):
    im = Image.open(image_path)
    im = im.resize((width, height), Image.NEAREST)
    txt = ''

    for i in range(width):
        for j in range(height):
            txt += rgb2char(*im.getpixel((j,i)))
        txt += '\n'

    return txt

if __name__ == '__main__':
    IMG_REG = re.compile('\.(jpe?g|png)$',re.I)
    img_list = []
    for file in os.listdir('.'):
        if IMG_REG.search(file):
            img_list.append(file) 
    
    for i,f in enumerate(img_list): 
        print(i ,' -> ', f)
    while True:
        fi = int(input('choose the index number\n'))
        if not img_list[fi]: 
            print('wrong input')
        else: 
            data = img2char(img_list[fi])
            print(data)
            break
