import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const artists=sqliteTable('artists',{id:text('id').primaryKey(),payload:text('payload').notNull(),deleted:integer('deleted').notNull().default(0)});
export const sections=sqliteTable('sections',{id:text('id').primaryKey(),name:text('name').notNull()});
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
