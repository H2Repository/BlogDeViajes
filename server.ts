import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/db/index.ts';
import { diaries, visitor_logs } from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // 1. API Routes for Diaries (MUST BE BEFORE VITE MIDDLEWARES)
  app.get('/api/diaries', async (req, res) => {
    try {
      const rows = await db.select().from(diaries).orderBy(desc(diaries.createdAt));
      const formatted = rows.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        date: row.date,
        time: row.time,
        location: {
          lat: row.lat ? parseFloat(row.lat) : 0,
          lng: row.lng ? parseFloat(row.lng) : 0,
          address: row.address || '',
          region: row.region || '',
        },
        photos: row.photos ? JSON.parse(row.photos) : [],
        weather: row.weather || 'sunny',
        moodTags: row.moodTags ? JSON.parse(row.moodTags) : [],
        localInsights: row.localInsights ? JSON.parse(row.localInsights) : { recommendedForSolo: '' },
        rating: row.rating || 5,
        views: row.views || 0,
        hasSubcollectionPhotos: !!row.hasSubcollectionPhotos,
        totalPhotosCount: row.totalPhotosCount || 0,
        createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).getTime() : Date.now(),
      }));
      res.json(formatted);
    } catch (err: any) {
      console.error('Error fetching diaries:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch diaries' });
    }
  });

  app.post('/api/diaries', async (req, res) => {
    try {
      const entry = req.body;
      if (!entry || !entry.id) {
        return res.status(400).json({ error: 'Invalid diary entry data' });
      }

      const values = {
        id: entry.id,
        title: entry.title || '제목 없음',
        content: entry.content || '',
        date: entry.date || '',
        time: entry.time || '',
        lat: entry.location?.lat != null ? String(entry.location.lat) : null,
        lng: entry.location?.lng != null ? String(entry.location.lng) : null,
        region: entry.location?.region || null,
        address: entry.location?.address || null,
        weather: entry.weather || 'sunny',
        rating: entry.rating || 5,
        views: entry.views || 0,
        photos: typeof entry.photos === 'string' ? entry.photos : JSON.stringify(entry.photos || []),
        moodTags: typeof entry.moodTags === 'string' ? entry.moodTags : JSON.stringify(entry.moodTags || []),
        localInsights: typeof entry.localInsights === 'string' ? entry.localInsights : JSON.stringify(entry.localInsights || { recommendedForSolo: '' }),
        hasSubcollectionPhotos: !!entry.hasSubcollectionPhotos,
        totalPhotosCount: entry.totalPhotosCount || (Array.isArray(entry.photos) ? entry.photos.length : 0),
        updatedAt: new Date(),
      };

      await db.insert(diaries)
        .values({
          ...values,
          createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
        })
        .onConflictDoUpdate({
          target: diaries.id,
          set: values,
        });

      res.json({ success: true, id: entry.id });
    } catch (err: any) {
      console.error('Error saving diary:', err);
      res.status(500).json({ error: err.message || 'Failed to save diary' });
    }
  });

  app.delete('/api/diaries/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(diaries).where(eq(diaries.id, id));
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error deleting diary:', err);
      res.status(500).json({ error: err.message || 'Failed to delete diary' });
    }
  });

  app.post('/api/diaries/:id/views', async (req, res) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(diaries).where(eq(diaries.id, id));
      if (existing) {
        const newViews = (existing.views || 0) + 1;
        await db.update(diaries).set({ views: newViews }).where(eq(diaries.id, id));
        res.json({ success: true, views: newViews });
      } else {
        res.status(404).json({ error: 'Diary not found' });
      }
    } catch (err: any) {
      console.error('Error incrementing views:', err);
      res.status(500).json({ error: err.message || 'Failed to increment views' });
    }
  });

  app.post('/api/diaries/reset-views', async (req, res) => {
    try {
      await db.update(diaries).set({ views: 0 });
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error resetting views:', err);
      res.status(500).json({ error: err.message || 'Failed to reset views' });
    }
  });

  // 2. API Routes for Visitor Logs
  app.get('/api/visitor-logs', async (req, res) => {
    try {
      const rows = await db.select().from(visitor_logs).orderBy(desc(visitor_logs.timestamp));
      const formatted = rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp ? new Date(row.timestamp).getTime() : Date.now(),
        lat: row.lat ? parseFloat(row.lat) : 0,
        lng: row.lng ? parseFloat(row.lng) : 0,
        city: row.city || '',
        country: row.country || '',
        region: row.region || '',
        diaryId: row.diaryId || undefined,
        diaryTitle: row.diaryTitle || undefined,
        device: row.device || '',
        ipMasked: row.ipMasked || undefined,
      }));
      res.json(formatted);
    } catch (err: any) {
      console.error('Error fetching visitor logs:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch visitor logs' });
    }
  });

  app.post('/api/visitor-logs', async (req, res) => {
    try {
      const log = req.body;
      if (!log || !log.id) {
        return res.status(400).json({ error: 'Invalid visitor log data' });
      }

      await db.insert(visitor_logs)
        .values({
          id: log.id,
          timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
          lat: log.lat != null ? String(log.lat) : null,
          lng: log.lng != null ? String(log.lng) : null,
          city: log.city || null,
          country: log.country || null,
          region: log.region || null,
          diaryId: log.diaryId || null,
          diaryTitle: log.diaryTitle || null,
          device: log.device || null,
          ipMasked: log.ipMasked || null,
        })
        .onConflictDoNothing();

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error recording visitor log:', err);
      res.status(500).json({ error: err.message || 'Failed to record visitor log' });
    }
  });

  // 3. Vite development server / Static asset fallback (AFTER API ROUTES)
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer();
