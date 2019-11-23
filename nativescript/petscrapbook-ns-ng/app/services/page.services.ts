import { Injectable } from '@angular/core';
import { Page } from '../models/page';
import * as fileSystem from 'file-system';
import * as imageSource from 'image-source';

@Injectable()
export class PageService {
    getPage(id: number): Page {
        const pages = this.getPages();
        const index = this.findPageIndex(pages, id);

        if (index === -1) {
            return null;
        }
        return pages[index];
    }

    getPages(): Array<Page> {
        const file = fileSystem.knownFolders.documents().getFile('scrapbook.json');
        const pages = file.readTextSync().length === 0 ? new Array<Page>() : <Array<Page>>JSON.parse(file.readTextSync());

        pages.forEach(page => {
            page.image = imageSource.fromBase64(page.imageBase64);
        })
        return pages;
    }

    savePage(scrapbookPage: Page): void {
        const file = fileSystem.knownFolders.documents().getFile('scrapbook.json');
        const pages = this.getPages();
        const index = this.findPageIndex(pages, scrapbookPage.id);
        let page = new Page();
        console.log('look for the iterable class keys ?')
        page.id = scrapbookPage.id;
        page.title = scrapbookPage.title;
        page.gender = scrapbookPage.gender;
        page.age = scrapbookPage.age;
        page.birthDate = scrapbookPage.birthDate;
        page.lat = scrapbookPage.lat;
        page.long = scrapbookPage.long;
        page.imageBase64 = scrapbookPage.imageBase64;

        if ( index !== -1 ) {
            pages[index] = page;
        } else {
            pages.push(page);
        }

        file.writeText(JSON.stringify(pages));
    }

    private findPageIndex(pages: any, id: number): number {
        return pages.findIndex(el => el.id === id);
    }
}