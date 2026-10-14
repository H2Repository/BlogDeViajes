import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VisitorLog } from '../types';
import { checkAdminPermission } from './diaryFirestore';

function maskIp(ip?: string): string {
  if (!ip) return '***';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts.slice(0, 3).join(':')}:****`;
  }
  return '***';
}

function detectDevice(): string {
  if (typeof navigator === 'undefined') return 'Desktop';
  const ua = navigator.userAgent || '';
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'Tablet';
  }
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
    return 'Mobile';
  }
  return 'Desktop';
}

async function fetchVisitorGeoLocation(): Promise<{
  lat: number;
  lng: number;
  city: string;
  country: string;
  region: string;
  ipMasked: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return {
          lat: data.latitude,
          lng: data.longitude,
          city: data.city || data.region || '알 수 없음',
          country: data.country || '대한민국',
          region: data.region || '',
          ipMasked: maskIp(data.ip),
        };
      }
    }
  } catch {}

  let defaultCity = '서울';
  let defaultLat = 37.5665;
  let defaultLng = 126.9780;
  let defaultCountry = '대한민국';

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes('Tokyo')) {
      defaultCity = '도쿄';
      defaultCountry = '일본';
      defaultLat = 35.6762;
      defaultLng = 139.6503;
    }
  } catch {}

  return {
    lat: defaultLat,
    lng: defaultLng,
    city: defaultCity,
    country: defaultCountry,
    region: '',
    ipMasked: '***',
  };
}

export async function recordVisitorLocation(diaryId?: string, diaryTitle?: string): Promise<void> {
  if (!diaryId) return;
  if (checkAdminPermission()) return;
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    if (/bot|googlebot|crawler|spider|robot|crawling|headless/i.test(ua)) return;
  }

  const sessionKey = `visitor_loc_logged_${diaryId}`;
  try {
    const lastLogged = sessionStorage.getItem(sessionKey);
    if (lastLogged) {
      const elapsed = Date.now() - Number(lastLogged);
      if (elapsed < 10 * 60 * 1000) return;
    }
    sessionStorage.setItem(sessionKey, String(Date.now()));
  } catch {}

  try {
    const geo = await fetchVisitorGeoLocation();
    const logId = `vlog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const logEntry: VisitorLog = {
      id: logId,
      timestamp: Date.now(),
      lat: geo.lat,
      lng: geo.lng,
      city: geo.city,
      country: geo.country,
      region: geo.region,
      diaryId: diaryId,
      diaryTitle: diaryTitle || '블로그 홈 피드',
      device: detectDevice(),
      ipMasked: geo.ipMasked,
    };

    // 1. Save to Cloud Firestore
    await setDoc(doc(db, 'visitor_logs', logId), logEntry);

    // 2. Save to PostgreSQL
    fetch('/api/visitor-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry),
    }).catch(() => {});
  } catch (err) {
    console.warn('Could not record visitor location:', err);
  }
}

export function subscribeVisitorLogs(
  onUpdate: (logs: VisitorLog[]) => void,
  onError?: (error: Error) => void
): () => void {
  const colRef = collection(db, 'visitor_logs');
  const q = query(colRef, orderBy('timestamp', 'desc'), limit(150));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: VisitorLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as VisitorLog;
        if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
          list.push(data);
        }
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Visitor logs subscription note:', err);
      if (onError) onError(err);
    }
  );
}

export async function clearAllVisitorLogs(): Promise<void> {
  if (!checkAdminPermission()) {
    throw new Error('방문자 위치 기록 초기화는 관리자만 가능합니다.');
  }
  const snap = await getDocs(collection(db, 'visitor_logs'));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}
