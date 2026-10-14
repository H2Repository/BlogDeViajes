import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const diaries = pgTable('diaries', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  lat: text('lat'),
  lng: text('lng'),
  region: text('region'),
  address: text('address'),
  weather: text('weather'),
  rating: integer('rating'),
  views: integer('views').default(0),
  photos: text('photos'), // JSON string of TravelPhoto[]
  moodTags: text('mood_tags'), // JSON string of string[]
  localInsights: text('local_insights'), // JSON string of LocalInsights
  hasSubcollectionPhotos: boolean('has_subcollection_photos'),
  totalPhotosCount: integer('total_photos_count'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const visitor_logs = pgTable('visitor_logs', {
  id: text('id').primaryKey(),
  timestamp: timestamp('timestamp').notNull(),
  lat: text('lat'),
  lng: text('lng'),
  city: text('city'),
  country: text('country'),
  region: text('region'),
  diaryId: text('diary_id'),
  diaryTitle: text('diary_title'),
  device: text('device'),
  ipMasked: text('ip_masked'),
});
