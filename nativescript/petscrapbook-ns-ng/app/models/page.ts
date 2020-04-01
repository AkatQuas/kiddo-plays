import { ImageSource } from 'image-source';

export class Page {
    id: number;
    title: string;
    age: string;
    birthDate: any;
    gender: string;
    lat: number;
    long: number;
    image: ImageSource;
    imageBase64: string;
}