import { Logger } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ForbiddenError } from 'apollo-server-express';
import { Types } from 'mongoose';
import { NoteService } from 'src/dao/note.service';
import { NoteDocument } from 'src/dao/schemas';
import { UserJWT } from 'src/utils';

@Resolver('Note')
export class NoteResolver {
  private readonly logger = new Logger(NoteResolver.name);

  private async ensureNoteAuthor(
    noteId: string,
    user: UserJWT,
  ): Promise<NoteDocument> {
    const note = await this.noteService.findById(noteId);
    console.log(
      `%c***** note.author *****`,
      'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
      '\n',
      note.author,
    );
    if (note && String(note.author._id) !== user.id) {
      throw new ForbiddenError("No permission to operate other's note.");
    }
    return note;
  }

  constructor(private noteService: NoteService) {}

  @Query('notes')
  async getNotes() {
    return this.noteService.findAll();
  }

  @Query('note')
  async getNote(@Args('id') id: string) {
    return this.noteService.findById(id);
  }

  @Query()
  async noteFeed(@Args('cursor') cursor: string) {
    const limit = 10;
    const cursorQuery = {} as any;
    if (cursor) {
      cursorQuery._id = { $gt: cursor };
    }

    const list = await this.noteService.findAll({
      ...cursorQuery,
      limit: limit + 1,
    });

    let hasNextPage = false;
    if (list.length > limit) {
      hasNextPage = true;
      list.pop();
    }

    const newCursor = list[list.length - 1]._id;
    return {
      notes: list,
      cursor: newCursor,
      hasNextPage,
    };
  }

  @Mutation('createNote')
  async newNote(
    @Args('content') content: string,
    @Context('user') user: UserJWT,
  ) {
    const note = await this.noteService.create({
      content,
      author: Types.ObjectId(user.id),
    });
    return note;
  }

  @Mutation()
  async updateNote(
    @Args('id') id: string,
    @Args('content') content: string,
    @Context('user') user: UserJWT,
  ) {
    void (await this.ensureNoteAuthor(id, user));
    try {
      return this.noteService.updateById(id, {
        content,
      });
    } catch (error) {
      this.logger.error(`UpdateNote with error: ${error.message}`);
      return null;
    }
  }

  @Mutation()
  async deleteNote(@Args('id') id: string, @Context('user') user: UserJWT) {
    const note = await this.ensureNoteAuthor(id, user);
    try {
      await note.remove();
      return true;
    } catch (error) {
      this.logger.error(`DeleteNote with error: ${error.message}`);
      return false;
    }
  }

  @Mutation()
  async toggleFavorite(@Args('id') id: string, @Context('user') user: UserJWT) {
    const note = await this.noteService.findById(id);
    const favored = note.favoredBy.some((user) => String(user._id) === user.id);
    const oid = Types.ObjectId(user.id);
    const update = {} as any;
    if (favored) {
      update.$pull = {
        favoredBy: oid,
      };
      update.$inc = {
        favoriteCount: -1,
      };
    } else {
      update.$push = {
        favoredBy: oid,
      };
      update.$inc = {
        favoriteCount: 1,
      };
    }

    return this.noteService.updateById(id, update);
  }
}
