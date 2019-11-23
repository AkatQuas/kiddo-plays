import { observable } from 'mobx';
import randomstring from 'randomstring';

export default class TodoModel {
    id = randomstring.generate();
    @observable title;
    @observable finished = false;

    constructor(title) {
        this.title = title;
    }
}