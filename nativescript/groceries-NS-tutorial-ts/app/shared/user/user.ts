const validator = require('email-validator');

export class User {
    email: string;
    password: string;
    isValidEmail(): boolean {
        return validator.validate(this.email);
    }
}