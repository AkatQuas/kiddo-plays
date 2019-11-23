import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {Location} from '@angular/common';

import {HeroService} from './hero.service'
import {Hero} from './hero'
import 'rxjs/add/operator/switchMap'
import {Subscription} from "rxjs/Subscription";
import {ComponentCanDeactivate} from "./hero-edit.guard";
import {Observable} from "rxjs/Observable";

@Component({
    selector: 'hero-detail',
    templateUrl: './hero-detail.component.html',
    styleUrls: ['./hero-detail.component.css']
})

export class HeroDetailComponent implements OnInit, OnDestroy, ComponentCanDeactivate {
    @Input() hero: Hero;
    query: string;
    done = false;
    private subscription: Subscription;

    constructor(private heroService: HeroService,
                private route: ActivatedRoute,
                private router: Router,
                private location: Location) {
        console.log(router)
    }

    ngOnInit() {
        console.log('hero detail', this.route);
        this.route.paramMap.switchMap((params: ParamMap) => this.heroService.getHero(+params.get('id'))).subscribe(hero => this.hero = hero)
        //    listen to the params in the route using subscribe
        //    the same thing could happen to query
        this.subscription = this.route.queryParams.subscribe((queryParams: any) => {
            console.log(queryParams['ana'])
            this.query = queryParams['ana'];
        });
    }

    goBack(): void {
        this.location.back();
    }

    canDeactivate(): Observable<boolean> | boolean {
        if (!this.done) {
            return confirm('Do you want to leave?')
        }
        return true;
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}
