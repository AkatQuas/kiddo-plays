import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { Cat } from './cat.model';
import { ReturnModelType } from '@typegoose/typegoose';

@Injectable()
export class CatsService {
    @InjectModel(Cat)
    private readonly catModel: ReturnModelType<typeof Cat>;


    // private readonly cats: Cat[] = [
    //     { name: 'Kitty', age: 2, breed: '' },
    //     { name: 'Dancy', age: 1 },
    // ];

    async create(cat: Cat) {
        const createdCat = new this.catModel(cat);
        return createdCat.save();
    }

    async findAll(): Promise<Cat[]> {
        const res = await this.catModel.find();
        res.map(i => {
            console.log(i.toJSON({ versionKey: false }));
        });
        return res.map(i => i.toJSON({ versionKey: false }));
    }

    async findById(catId: string) {
        const res = await this.catModel.findById(catId);
        // todo convert the data gracefully
        return res.toJSON({ versionKey: false, });
    }

    async findByUser(user: string): Promise<Cat> {
        Logger.log(`Finding the cat by ${user}`);
        const res = await this.catModel.find();
        return res[0];
    }
}
