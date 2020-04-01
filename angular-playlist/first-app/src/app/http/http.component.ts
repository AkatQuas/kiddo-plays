import {Component, OnInit} from '@angular/core';
import {Response} from "@angular/http"
import {HttpService} from "../service/http.service";

@Component({
    selector: 'app-http',
    templateUrl: './http.component.html'
})
export class HttpComponent implements OnInit {
    items: any[] = [];
    asyncString = this.httpService.getData();
    constructor(private httpService: HttpService) {
    }

    ngOnInit() {
        // If you do not json the data before the observable, you have to use the json() function
        //
        // this.httpService.getData().subscribe(
        //     (data: Response) => {
        //         console.log(data)
        //         get the useful data from response
                // console.log(data.json())
            // }
        // );
    //    but if you do the json in the http service, which is a good way to do.
        this.httpService.getData().subscribe(
            (data: any) => {
                console.log(data)
            },
            (error) => {
                console.log(error)
            }
        );
    }
    onSubmit(username: string, email: string) {
        this.httpService.sendData({username: username, email: email}).subscribe(
            (data: any) => {
                console.log(data)
            }
        )
    }
    onGetData() {
        this.httpService.getOwnData().subscribe(
            data => {
                // don't forget to format the data to Array!
                this.items = data;
            }
        );
    }

}
