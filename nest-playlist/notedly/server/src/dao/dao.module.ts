import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { NoteService } from 'src/dao/note.service';
import { Note, User } from 'src/dao/schemas';
import { UserService } from 'src/dao/user.service';

@Module({
  imports: [TypegooseModule.forFeature([Note, User])],
  providers: [NoteService, UserService],
  exports: [TypegooseModule, NoteService, UserService],
})
export class DaoModule {}
