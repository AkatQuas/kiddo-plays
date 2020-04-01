import {
    AfterContentChecked,
    AfterContentInit,
    AfterViewChecked,
    AfterViewInit,
    Component,
    ContentChild,
    DoCheck,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    ViewChild
} from '@angular/core';

@Component({
    selector: 'app-lifecycle',
    template: `
        <h3>Lifecycle Component</h3>
        <p #bp>
            lifecycle Works! {{lifehere}}
        </p>
        <p>{{bp.textContent}}</p>
        <hr>
        <ng-content></ng-content>
    `,
    styles: []
})
export class LifecycleComponent implements OnInit, OnChanges, DoCheck, AfterContentInit, AfterContentChecked, AfterViewInit, AfterViewChecked, OnDestroy {
    @Input() lifehere: string = '123'
    @ViewChild('bp') boundParagraph: HTMLElement // local reference of view
    @ContentChild('cp') contentParagraph: HTMLElement // reference of content
    constructor() {
    }

    ngOnInit() {
        console.log('init')
        console.log(this)
    }

    ngOnChanges() {
        console.log('change')
    }

    ngDoCheck() {
        console.log('do check')
        console.log(this.boundParagraph)
    }

    ngAfterContentInit() {
        console.log('after content init')
    }

    ngAfterContentChecked() {
        console.log('after content checked')
    }

    ngAfterViewInit() {
        console.log('after view init')
    }

    ngAfterViewChecked() {
        console.log('after view checked')
    }

    ngOnDestroy() {
        console.log('destroy')
    }

    private log(hook: string) {
        console.log(hook)
    }

}
