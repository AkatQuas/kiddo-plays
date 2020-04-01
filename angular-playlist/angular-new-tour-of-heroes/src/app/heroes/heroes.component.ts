import { Component, OnInit } from '@angular/core';
import { Hero } from '../hero';
import { HeroService } from "../hero.service";
import { Router } from '@angular/router';

@Component({
  selector: 'app-heroes',
  templateUrl: './heroes.component.html',
  styleUrls: ['./heroes.component.less']
})
export class HeroesComponent implements OnInit {
  heroes: Hero[];
  selectedHero: Hero;
  constructor(private heroService: HeroService, private router: Router) { }

  ngOnInit() {
    this.getHeroes();
  }
  getHeroes(): void {
    this.heroService.getHeroes()
      .subscribe(heroes => this.heroes = heroes);
  }

  onSelect(hero: Hero): void {
    this.router.navigateByUrl(`/detail/${hero.id}`);
  }
  add(name:string): void {
    name = name.trim();
    if (!name) { return; }
    this.heroService.addHero({name} as Hero).subscribe(_ => {
        this.getHeroes();
    })
  }
  delete(hero: Hero): void {
    console.log(hero);
    this.heroService.deleteHero(hero).subscribe(_ => {
      this.getHeroes();
    });
  }
}
