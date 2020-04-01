# encoding: utf-8

def lines(file):
    '''
        generator, create an empty line at the EOF
    '''
    for line in file: yield line
    yield '\n'

def blocks(file):
    '''
        generator, create text block
    '''
    block = []
    for line in lines(file):
        if line.strip():
            block.append(line)
        elif block:
            yield ''.join(block).strip()
            block = []
