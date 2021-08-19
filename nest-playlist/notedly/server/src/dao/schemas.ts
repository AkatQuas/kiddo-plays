import { modelOptions, prop, Ref } from '@typegoose/typegoose';
import { Document, Types } from 'mongoose';

// #region User

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class User {
  @prop()
  createdAt: Date; // provided by schemaOptions.timestamps
  @prop()
  updatedAt: Date; // provided by schemaOptions.timestamps
  id: string; // _id getter as string

  @prop({
    required: true,
    unique: true,
  })
  username: string;

  @prop({
    required: true,
    select: false,
  })
  password: string;

  @prop()
  avatar: string;
}

export type UserDocument = User & Document;

export interface CreateUserDto {
  readonly username: string;
  readonly password: string;
  readonly avatar?: string;
}

export interface UpdateUserDto {
  readonly password: string;
  readonly avatar?: string;
}
// #endregion

// #region Note

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class Note {
  @prop()
  createdAt: Date; // provided by schemaOptions.timestamps
  @prop()
  updatedAt: Date; // provided by schemaOptions.timestamps
  id: string; // _id getter as string

  @prop({
    required: true,
  })
  content: string;

  @prop({
    required: true,
    ref: () => User,
  })
  author: Ref<UserDocument>;

  @prop({
    default: 0,
  })
  favoriteCount: number;

  @prop({
    ref: () => User,
  })
  favoredBy: Ref<UserDocument>[];
}

export type NoteDocument = Note & Document;

export interface CreateNoteDto {
  readonly content: string;
  readonly author: Types.ObjectId;
}

export interface UpdateNoteDto {
  readonly content: string;
}

// #endregion
