import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { HousingLocation } from '../housing-location';
import { HousingLocationComponent } from '../housing-location/housing-location.component';
import { HousingService } from '../housing.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HousingLocationComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  housingLocationList: HousingLocation[] = [];
  housingService = inject(HousingService);
  filteredList: HousingLocation[] = [];

  constructor() {
    this.housingService.getAll().then((list) => {
      this.housingLocationList = list;
      this.filteredList = list;
    });
  }

  filterResults(text: string) {
    if (!text) {
      this.filteredList = this.housingLocationList;
      return;
    }

    this.filteredList = this.housingLocationList.filter((h) =>
      h.city.toLocaleLowerCase().includes(text.toLowerCase())
    );
  }
}
