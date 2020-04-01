import {Component} from '@angular/core';

import {Hero} from '../hero/hero'
import {HeroService} from '../hero/hero.service'

@Component({
    selector: 'my-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})

export class DashboardComponent {
    heroes: Hero[] = [];

    constructor(private heroService: HeroService) {
    }

    ngOnInit(): void {
        this.heroService.getHeroes().then(heroes => {
            let l = heroes.length;
            l = Math.floor(Math.random() * (l - 4))
            this.heroes = heroes.slice(l, l + 4)
        })
    }
}
