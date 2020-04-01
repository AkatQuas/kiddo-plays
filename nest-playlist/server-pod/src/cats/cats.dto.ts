/**
 * this is old way to creating DAO
 * more can be read at https://docs.nestjs.com/techniques/mongodb
 */
import { IsString, IsInt } from 'class-validator';

export class CreateCatDto {
    @IsString()
    readonly name: string;

    @IsInt()
    readonly age: number;

    @IsString()
    readonly breed?: string;
}


export class UpdateCatDto {
    readonly age?: number;
    readonly name?: string;
    readonly breed?: string;
}

export class ListAllEntities {
    readonly limit?: number;
    readonly skip?: number;
}
