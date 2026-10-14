import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc,
  increment,
  deleteDoc, 
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DiaryEntry, TravelPhoto } from '../types';
import { getStoredDiaries, saveDiaries as saveToLocalCache, sortDiariesDescending } from '../utils/storage';
import { mergeRemoteWithPendingQueue } from '../utils/offlineSync';

export function checkAdminPermission(): boolean {
  try {
    return sessionStorage.getItem('hills_admin_auth') === 'true' || localStorage.getItem('hills_admin_auth') === 'true';
  } catch {
    return false;
  }
}

function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

function getByteSize(obj: any): number {
  try {
    return new TextEncoder().encode(JSON.stringify(obj)).length;
  } catch {
    return 0;
  }
}

// Background mirror to PostgreSQL (supports unlimited size up to 1GB)
async function mirrorToPostgres(entry: DiaryEntry): Promise<void> {
  try {
    await fetch('/api/diaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch {
    // Non-blocking in frontend
  }
}

export function subscribeDiaries(
  onUpdate: (diaries: DiaryEntry[], isInitialSync: boolean) => void,
  onError?: (error: Error) => void
): () => void {
  const cached = getStoredDiaries();
  if (cached.length > 0) {
    onUpdate(sortDiariesDescending(mergeRemoteWithPendingQueue(cached)), false);
  }

  // 1. Subscribe to Firebase Cloud Firestore for instant cross-domain real-time sync
  const diariesCol = collection(db, 'diaries');

  const unsubscribeFirestore = onSnapshot(
    diariesCol,
    (snapshot) => {
      const list: DiaryEntry[] = [];
      snapshot.forEach((docSnap) => {
        try {
          const raw = docSnap.data();
          if (raw && (raw.id || docSnap.id)) {
            const data: DiaryEntry = {
              id: raw.id || docSnap.id,
              title: raw.title || '제목 없음',
              content: typeof raw.content === 'string' ? raw.content : '',
              date: raw.date || '',
              time: raw.time || '',
              location: raw.location || { lat: 21.0285, lng: 105.8542, address: '', region: '위치 미지정' },
              photos: Array.isArray(raw.photos) ? raw.photos : [],
              weather: raw.weather || 'sunny',
              moodTags: Array.isArray(raw.moodTags) ? raw.moodTags : [],
              localInsights: raw.localInsights || { recommendedForSolo: '' },
              rating: typeof raw.rating === 'number' ? raw.rating : 5,
              views: typeof raw.views === 'number' ? raw.views : 0,
              hasSubcollectionPhotos: !!raw.hasSubcollectionPhotos,
              totalPhotosCount: raw.totalPhotosCount,
              createdAt: raw.createdAt || Date.now(),
              updatedAt: raw.updatedAt || Date.now(),
            };
            list.push(data);
            mirrorToPostgres(data);
          }
        } catch (err) {
          console.warn('Diary parse note:', err);
        }
      });

      // Supply immediate list first
      const immediateList = sortDiariesDescending(mergeRemoteWithPendingQueue(list));
      saveToLocalCache(immediateList);
      onUpdate(immediateList, true);

      // Asynchronously enrich any diaries that have full photos stored in subcollections
      const largeDiaries = list.filter((d) => d.hasSubcollectionPhotos);
      if (largeDiaries.length > 0) {
        Promise.all(
          largeDiaries.map(async (entry) => {
            const subPhotos = await fetchDiaryFullPhotos(entry.id);
            if (subPhotos.length > 0) {
              entry.photos = subPhotos;
            }
          })
        ).then(() => {
          const enrichedList = sortDiariesDescending(mergeRemoteWithPendingQueue(list));
          saveToLocalCache(enrichedList);
          onUpdate(enrichedList, true);
        }).catch((err) => {
          console.warn('Background subcollection photos load note:', err);
        });
      }
    },
    (err) => {
      console.warn('Firestore snapshot note, trying PostgreSQL API fallback:', err);
      fetchFromPostgres();
    }
  );

  // 2. Also poll PostgreSQL API to keep PostgreSQL & Firestore seamlessly synchronized
  const fetchFromPostgres = async () => {
    try {
      const res = await fetch('/api/diaries');
      if (res.ok) {
        const list: DiaryEntry[] = await res.json();
        if (list && list.length > 0) {
          const immediateList = sortDiariesDescending(mergeRemoteWithPendingQueue(list));
          saveToLocalCache(immediateList);
          onUpdate(immediateList, true);
        }
      }
    } catch {
      // ignore
    }
  };

  fetchFromPostgres();

  return () => {
    unsubscribeFirestore();
  };
}

export async function saveDiaryToFirestore(entry: DiaryEntry): Promise<void> {
  const sanitized = sanitizeForFirestore(entry);
  const totalBytes = getByteSize(sanitized);

  // Firestore single document limit is strictly 1,048,576 bytes (1 MiB).
  // If total diary payload > 750KB, save attached photos to the 'photos' subcollection
  // while keeping only the cover photo in the root document.
  if (totalBytes > 750 * 1024 && Array.isArray(entry.photos) && entry.photos.length > 0) {
    const coverPhoto = entry.photos.find((p) => p.isCover) || entry.photos[0];
    const rootDocData = {
      ...sanitized,
      photos: coverPhoto ? [coverPhoto] : [],
      hasSubcollectionPhotos: true,
      totalPhotosCount: entry.photos.length,
    };

    // 1. Save lightweight root document (stays comfortably under 1MB)
    await setDoc(doc(db, 'diaries', entry.id), rootDocData);

    // 2. Save each attached photo into the subcollection
    const photoPromises = entry.photos.map((p) =>
      setDoc(doc(db, 'diaries', entry.id, 'photos', p.id), sanitizeForFirestore(p))
    );
    await Promise.all(photoPromises);
  } else {
    // Normal size: save all photos in the root document
    await setDoc(doc(db, 'diaries', entry.id), sanitized);
  }

  // 3. Save full entry to PostgreSQL (PostgreSQL text column supports up to 1GB!)
  try {
    await fetch('/api/diaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch (err) {
    console.warn('PostgreSQL save note:', err);
  }
}

export async function updateOptimizedDiaryToFirestore(entry: DiaryEntry): Promise<void> {
  return saveDiaryToFirestore(entry);
}

export async function deleteDiaryFromFirestore(id: string): Promise<void> {
  // 1. Delete all subcollection photo documents
  try {
    const photoSnap = await getDocs(collection(db, 'diaries', id, 'photos'));
    await Promise.all(photoSnap.docs.map((d) => deleteDoc(d.ref)));
  } catch {}

  // 2. Delete root Firestore document
  await deleteDoc(doc(db, 'diaries', id));

  // 3. Delete from PostgreSQL
  try {
    await fetch(`/api/diaries/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('PostgreSQL delete note:', err);
  }
}

export async function incrementDiaryViews(id: string): Promise<void> {
  updateDoc(doc(db, 'diaries', id), { views: increment(1) }).catch(() => {});
  fetch(`/api/diaries/${encodeURIComponent(id)}/views`, { method: 'POST' }).catch(() => {});
}

export async function resetAllDiaryViews(): Promise<void> {
  if (!checkAdminPermission()) {
    throw new Error('조회수 초기화는 관리자만 가능합니다.');
  }
  const snap = await getDocs(collection(db, 'diaries'));
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { views: 0 })));
  fetch('/api/diaries/reset-views', { method: 'POST' }).catch(() => {});
}

export async function fetchDiaryFullPhotos(diaryId: string): Promise<TravelPhoto[]> {
  try {
    const snap = await getDocs(collection(db, 'diaries', diaryId, 'photos'));
    const list: TravelPhoto[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as TravelPhoto;
      if (data && data.url) {
        list.push(data);
      }
    });
    return list;
  } catch (err) {
    console.warn('Error fetching diary full photos from subcollection:', err);
    return [];
  }
}
