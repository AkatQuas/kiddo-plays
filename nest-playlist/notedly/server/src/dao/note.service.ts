import { Injectable } from '@nestjs/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { QueryOptions } from 'mongoose';
import { InjectModel } from 'nestjs-typegoose';
import { PaginationQuery } from 'src/utils';
import { CreateNoteDto, Note, NoteDocument, UpdateNoteDto } from './schemas';

@Injectable()
export class NoteService {
  constructor(
    @InjectModel(Note) private noteModel: ReturnModelType<typeof Note>,
  ) {}

  async create(createNoteDto: CreateNoteDto): Promise<NoteDocument> {
    const createdNote = new this.noteModel(createNoteDto);
    return createdNote.save();
  }

  async findAll(q: PaginationQuery = {}): Promise<NoteDocument[]> {
    const { limit = 10, ...filter } = q;
    const query = this.noteModel.find(filter);
    if (limit) {
      query.limit(limit);
    }
    return query.populate('author favoredBy');
  }

  async findById(id: string): Promise<NoteDocument> {
    return this.noteModel.findById(id).populate('author favoredBy');
  }

  async updateById(
    id: string,
    updateNoteDto: UpdateNoteDto,
    q: QueryOptions = {},
  ): Promise<NoteDocument> {
    return this.noteModel.findByIdAndUpdate(id, updateNoteDto, {
      populate: 'author favoredBy',
      new: true,
      ...q,
    });
  }

  async deleteById(id: string): Promise<NoteDocument> {
    return this.noteModel.findByIdAndDelete(id);
  }
}
