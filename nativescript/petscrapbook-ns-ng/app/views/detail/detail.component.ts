import { Component, OnInit, ViewContainerRef } from '@angular/core';
import { Page } from '../../models/page';
import { RouterExtensions, PageRoute } from 'nativescript-angular/router';
import { NavigationOptions } from 'nativescript-angular/router/ns-location-strategy';
import { PageService } from '../../services/page.services';
import 'rxjs/add/operator/switchMap';
import { ModalDialogService, ModalDialogOptions } from 'nativescript-angular/modal-dialog';
import { SelectDateComponent } from '../modals/select-date/select-date.component'
import { SelectGenderComponent } from '../modals/select-gender/select-gender.component'
import * as camera from 'nativescript-camera';
import * as geolocation from 'nativescript-geolocation';
import { ImageSource } from 'image-source';

@Component({
    moduleId: module.id,
    providers: [PageService],
    templateUrl: './detail.html'
})
export class DetailComponent implements OnInit {
    page: Page;
    constructor(
        private _router: RouterExtensions,
        private _pageService: PageService,
        private _pageRoute: PageRoute,
        private _modalService: ModalDialogService,
        private _viewContainerRef: ViewContainerRef
    ) {

    }

    ngOnInit(): void {
        let id: number;
        this._pageRoute.activatedRoute.switchMap(activatedRoute => activatedRoute.params).forEach( params => {
            id = +params['id'];
        })
        this.page = this._pageService.getPage(id);
        if (!this.page) {
            this.page = <Page>{ id };
        }
    }

    onSave(): void {
        this._pageService.savePage(this.page);
        const options = <NavigationOptions> {
            clearHistory: true
        };
        // this._router.navigate(['list'], options);
        this._router.back();
    }
    onBirthDate(): void {
        const options: ModalDialogOptions = {
            context: this.page.birthDate || Date.now(),
            fullscreen: true,
            viewContainerRef: this._viewContainerRef
        }
        this._modalService.showModal(SelectDateComponent, options).then((dialogResult: any) => {
            this.page.birthDate = dialogResult;
            const now = Date.now();
            const diff = Math.abs(now - this.page.birthDate) / 1000 / 3153600;
            this.page.age = diff.toFixed(1);
        })
    }
    onGender(): void {
        const options: ModalDialogOptions = {
            context: this.page.gender,
            fullscreen: true,
            viewContainerRef: this._viewContainerRef
        }

        this._modalService.showModal(SelectGenderComponent, options).then((res: string) => {
            this.page.gender = res;
        })
    }

    onAddImage(): void {
        if (!geolocation.isEnabled()) {
            geolocation.enableLocationRequest();
        }
        camera.requestPermissions();
        camera.takePicture({
            width: 100,
            height: 100,
            keepAspectRatio: true
        }).then( pic => {
            let img = new ImageSource();
            img.fromAsset(pic).then(imgsrc => {
                this.page.image = imgsrc;
                this.page.imageBase64 = this.page.image.toBase64String('png'); 
            })

            geolocation.getCurrentLocation(null).then(location => {
                this.page.lat = location.latitude;
                this.page.long = location.longitude;
            })
        })
    }
}