import {Injectable} from '@angular/core';
import {User} from "./user";
import {Router} from "@angular/router";

@Injectable()
export class AuthServiceService {

    authedUser: User[] = [];
    signedupUser: User[] = [];
    authedTOKEN = false;

    constructor(private router: Router) {
    }

    signUp(user: User) {
        this.signedupUser.push(user)
        this.logUsers()
    }

    signIn(user: User) {
        let auth = false;
        this.signedupUser.forEach(v => {
            if (v.email === user.email) {
                this.authedUser.push(user)
                auth = true;
            }
        })
        if (auth) {
            this.setToken(true);
            this.logUsers()
        } else {
            this.setToken(false);
            alert('not authed user!')
        }
    }

    logOut(user: User) {
        let idx = null;
        this.authedUser.forEach((v, i) => {
            if (v.email === user.email) {
                idx = i;
            }
        })
        if (idx !== null) {
            this.authedUser.splice(idx, 1)
            alert('redirecting to another page')
            this.router.navigate(['/dashboard'])
        } else {
            alert('can not log out non-authed user')
        }
    }

    fetchSignedUser(): User[] {
        if (this.signedupUser.length > 0) {
            return this.signedupUser;
        } else {
            return [{
                password: null,
                email: 'no user signed'
            }]
        }
    }
    fetchAuthedUser(): User[] {
        if (this.authedUser.length > 0) {
            return this.authedUser;
        } else {
            return [{
                password: null,
                email: 'no user authed'
            }]
        }
    }

    getToken(): boolean {
        return this.authedTOKEN;
    }

    setToken(payload: boolean) {
        this.authedTOKEN = payload;
    }

    logUsers() {
        console.log('signed users', this.signedupUser);
        console.log('authed users', this.authedUser);
    }

}
