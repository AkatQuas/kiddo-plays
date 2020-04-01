assume cs:code, ds: a, ss: b

a segment
	dw 1,2,3,4,5,6,7,8
a ends

b segment
	dw 0,0,0,0,0,0,0,0
b ends

code segment
start:	mov ax, b
	mov ss, ax
	mov sp, 16
	mov ax, a
	mov ds, ax
	mov bx, 0
	mov cx, 8
 s: push [bx]
	add bx, 2
	loop s

	mov ax, 4c00h
	int 21h
code ends
end start
