import { NgModule, NO_ERRORS_SCHEMA } from "@angular/core";
import { NativeScriptModule } from "nativescript-angular/nativescript.module";
import { NativeScriptFormsModule } from 'nativescript-angular/forms';
import { AppRoutingModule, navigatableComponents } from './app-routing.module';

import { AppComponent } from "./app.component";
import { SelectDateComponent } from "./views/modals/select-date/select-date.component";
import { SelectGenderComponent } from "./views/modals/select-gender/select-gender.component";

@NgModule({
  declarations: [
    AppComponent,
    SelectDateComponent,
    SelectGenderComponent,
    ...navigatableComponents
  ],
  entryComponents: [
    SelectDateComponent,
    SelectGenderComponent,
  ],
  bootstrap: [AppComponent],
  imports: [
    NativeScriptModule,
    NativeScriptFormsModule,
    AppRoutingModule
  ],
  schemas: [NO_ERRORS_SCHEMA],
})
export class AppModule {}
