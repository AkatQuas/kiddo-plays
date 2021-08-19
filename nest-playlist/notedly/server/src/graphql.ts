
/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */
export class Note {
    id: string;
    content: string;
    author: string;
    createdAt: DateTime;
    updatedAt: DateTime;
}

export abstract class IQuery {
    notes?: Nullable<Note[]>;
    note?: Nullable<Note>;
    hello?: Nullable<string>;
    c?: Nullable<Date>;
    b?: Nullable<DateTime>;
    j?: Nullable<JSON>;
}

export abstract class IMutation {
    createNote: Note;
    updateNote?: Nullable<Note>;
    deleteNote: boolean;
}

export type JSON = any;
export type DateTime = any;
type Nullable<T> = T | null;
