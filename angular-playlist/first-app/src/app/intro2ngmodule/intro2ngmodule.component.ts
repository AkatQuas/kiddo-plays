import {Component, OnInit} from '@angular/core';

@Component({
    selector: 'app-intro2ngmodule',
    template: `
        <p>
            @NgModule:
        </p>
        <ul class="list-group">
            <li class="list-group-item"><strong>Declarations: </strong>where you import the components, pipes, directives, and you can use them anywhere in your whole application.</li>
            <li class="list-group-item"><strong>Imports: </strong>where you import the finished modules, <i>BrowserModule, FormsModule, ReactiveFormsModule, HttpModule, AppRoutingModule,</i> etc.</li>
            <li class="list-group-item"><strong>Providers: </strong>All the service used in your whole application. <i>Providers</i> still works in individual component.</li>
            <li class="list-group-item"><strong>Bootstrap: </strong>Specify the init component, typically you only have one component here which is always <i>AppComponent</i>.</li>
        </ul>
    `,
    styles: []
})
export class Intro2ngmoduleComponent implements OnInit {

    constructor() {
    }

    ngOnInit() {
    }

}
