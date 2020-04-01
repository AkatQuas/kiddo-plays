assume cs:code, ds: data, ss: stack

data segment
 db 'ibm             '
 db 'dec             '
 db 'dos             '
 db 'vax             '
data ends

stack segment
    dw 0000h
stack ends

code segment
start:
    mov ax, data
    mov ds, ax
    mov ax, stack
    mov ss, ax
    mov sp, 10h
    mov bx, 0
    mov cx, 4
 s0:
    push cx
    mov di, 0
    mov cx, 3
  s:mov al, [bx][di]
    and al, 11011111b
    mov [bx][di],al
    inc di
    loop s
    add bx, 10h
    pop cx
    loop s0

    mov ax, 4c00h
    int 21h
code ends
end start
