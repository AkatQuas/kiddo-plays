import { Component, OnInit } from '@angular/core';
import { Set, SetListGQL } from '@nrwl-todos/data-access';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'tenant-set-list',
  templateUrl: './set-list.component.html',
  styleUrls: ['./set-list.component.less'],
})
export class SetListComponent implements OnInit {
  sets$: Observable<Set[]>;

  constructor(private setListGQL: SetListGQL) {
    this.sets$ = this.setListGQL
      .watch()
      .valueChanges.pipe(map((result) => result.data.allSets));
  }

  ngOnInit(): void {}
}
