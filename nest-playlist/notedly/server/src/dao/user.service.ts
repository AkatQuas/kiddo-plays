import { Injectable } from '@nestjs/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { CreateUserDto, User, UserDocument } from 'src/dao/schemas';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User) private userModel: ReturnModelType<typeof User>,
  ) {}

  async find(filter = {}): Promise<UserDocument[]> {
    return this.userModel.find(filter);
  }

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const createdUser = new this.userModel(createUserDto);
    return createdUser.save();
  }

  async findById(id: string): Promise<UserDocument> {
    return this.userModel.findById(id);
  }

  async findOne(
    query: Partial<CreateUserDto>,
    withPassword = false,
  ): Promise<UserDocument> {
    const p = this.userModel.findOne(query);
    return withPassword ? p.select('+password') : p;
  }

  // async updateById(id: string, updateUserDto: UpdateUserDto): Promise<User> {
  //   // todo
  // }
}
