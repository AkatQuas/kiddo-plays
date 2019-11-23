assume cs:code, ds: data

data segment
 db '1. display      '
 db '2. brows        '
 db '3. replace      '
 db '4. modify       '
data ends

code segment
start:
    mov ax, data
    mov ds, ax
    mov bx, 0
    mov cx, 4
 s0:
    mov dx, cx
    mov cx, 4
    mov di, 3
  s:mov al, [bx][di]
    and al, 11011111b
    mov [bx][di],al
    inc di
    loop s
    add bx, 10h
    mov cx, dx
    loop s0

    mov ax, 4c00h
    int 21h
code ends
end start
