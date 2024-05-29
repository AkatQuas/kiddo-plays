import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HousingLocation } from '../housing-location';
import { HousingService } from '../housing.service';

@Component({
  selector: 'app-housing-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './housing-detail.component.html',
  styleUrl: './housing-detail.component.css',
})
export class HousingDetailComponent {
  route = inject(ActivatedRoute);
  housingSrv = inject(HousingService);

  item?: HousingLocation;
  applyForm = new FormGroup({
    first_name: new FormControl(''),
    last_name: new FormControl(''),
    email: new FormControl(''),
  });

  constructor() {
    const id = parseInt(this.route.snapshot.params['id'], 10);
    this.housingSrv.getById(id).then((h) => {
      this.item = h;
    });
  }

  apply() {
    const { first_name, last_name, email } = this.applyForm.value;
    this.housingSrv.submit({
      first_name: first_name ?? '',
      last_name: last_name ?? '',
      email: email ?? '',
    });
  }
}
