import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-lazy-input',
  templateUrl: './lazy-input.component.html',
  styleUrls: ['./lazy-input.component.less']
})
export class LazyInputComponent implements OnInit {
  query: string = null;
  inputValue = new FormControl();

  constructor() {
    this.inputValue.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged()
      ).subscribe((v) => {
        this.query = v;
      });
  }

  ngOnInit() {
  }

}
