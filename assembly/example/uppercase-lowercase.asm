assume cs:code, ds:data
data segment
    db 'BaSiC'
    db 'iNfOrMaTiOn'
data ends

code segment
start:
    mov ax, data
    mov ds, ax
    mov cx, 5
    mov bx, 0
  b:mov al, [bx]
    and al, 11011111b
    mov [bx], al
    inc bx
    loop b
    mov cx, 11
    inc bx
  s:mov al, [bx]
    or al, 00100000b
    mov [bx], al
    inc bx
    loop s
    mov ax, 4c00h
    int 21h
code ends
end start
