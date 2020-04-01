assume cs:code, ds:data
data segment
    db 'welcome to masm!'
    db '................'
data ends

code segment
start:
    mov ax, data
    mov ds, ax
    mov cx, 8
    ;; mov bx, 0
    mov di, 0
s:
        ;; mov ax, [bx][di]
    mov ax, [di]
        ; mov [si+16], ax
        ;; mov [bx][si+16], ax
    mov 16[di],ax 
    add di, 2
    loop s

    mov ax, 4c00h
    int 21h
code ends
end start
