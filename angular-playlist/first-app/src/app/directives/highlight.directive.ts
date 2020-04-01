import {Directive, ElementRef, HostBinding, HostListener, Input, OnInit, Renderer} from '@angular/core';

@Directive({
    selector: '[appHighlight]'
})
export class HighlightDirective implements OnInit {
    @Input() defaultColor = 'blue';
    @Input('appHighlight') highlightColor = 'green';
    private backgroundColor = this.defaultColor;

    @HostListener('mouseenter')
    mouseover() {
        this.backgroundColor = this.highlightColor;
    }

    @HostListener('mouseleave')
    mouseleave() {
        this.backgroundColor = this.defaultColor;
    }

    @HostBinding('style.backgroundColor')
    get setColor() {
        return this.backgroundColor;
    }

    constructor(private elementRef: ElementRef, private renderer: Renderer) {
        // this.elementRef.nativeElement.style.backgroundColor = 'green';
        //   this.renderer.setElementStyle(this.elementRef.nativeElement, 'background-color', 'orange');
    }

    ngOnInit() {
        this.backgroundColor = this.defaultColor;
    }

}
