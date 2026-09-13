/**
 * Parse a pasted YouTube or Google Drive URL into an embeddable resource.
 *
 * Returns { provider, kind, id, url, embedUrl, label } or null when the URL
 * is not a supported YouTube / Google Drive / Google Docs link.
 */

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;

function normalize(input) {
  if (typeof input !== 'string') return null;
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function youtube(u) {
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
  let id = null;

  if (host === 'youtu.be') {
    id = u.pathname.split('/').filter(Boolean)[0] || null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') {
      id = u.searchParams.get('v');
    } else if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
      id = parts[1] || null;
    } else if (parts[0] === 'playlist') {
      const list = u.searchParams.get('list');
      if (list) {
        return {
          provider: 'youtube',
          kind: 'playlist',
          id: list,
          url: u.toString(),
          embedUrl: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}`,
          label: 'YouTube Playlist'
        };
      }
    }
  } else {
    return null;
  }

  if (!id || !YT_ID.test(id)) return null;

  const params = new URLSearchParams();
  const t = u.searchParams.get('t') || u.searchParams.get('start');
  if (t) {
    const secs = parseTimestamp(t);
    if (secs > 0) params.set('start', String(secs));
  }
  params.set('rel', '0');
  return {
    provider: 'youtube',
    kind: 'video',
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}?${params.toString()}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    label: 'YouTube'
  };
}

function parseTimestamp(t) {
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m) return 0;
  return (parseInt(m[1] || 0, 10) * 3600) + (parseInt(m[2] || 0, 10) * 60) + parseInt(m[3] || 0, 10);
}

function googleDrive(u) {
  const host = u.hostname.replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean);

  if (host === 'drive.google.com') {
    // /file/d/<id>/view , /file/d/<id>/preview
    if (parts[0] === 'file' && parts[1] === 'd' && parts[2]) {
      return driveFile(parts[2], u);
    }
    // /open?id=<id>  or /uc?id=<id>
    if ((parts[0] === 'open' || parts[0] === 'uc') && u.searchParams.get('id')) {
      return driveFile(u.searchParams.get('id'), u);
    }
    // /drive/folders/<id>  or /drive/u/0/folders/<id>
    const fi = parts.indexOf('folders');
    if (fi !== -1 && parts[fi + 1]) {
      const id = parts[fi + 1];
      if (!DRIVE_ID.test(id)) return null;
      return {
        provider: 'gdrive',
        kind: 'folder',
        id,
        url: `https://drive.google.com/drive/folders/${id}`,
        embedUrl: `https://drive.google.com/embeddedfolderview?id=${id}#list`,
        label: 'Google Drive Folder'
      };
    }
    return null;
  }

  if (host === 'docs.google.com') {
    // /document/d/<id>/edit , /presentation/d/<id>, /spreadsheets/d/<id>, /forms/d/<id>
    const typeMap = {
      document: { kind: 'doc', label: 'Google Docs', tail: 'preview' },
      presentation: { kind: 'slides', label: 'Google Slides', tail: 'embed?start=false&loop=false' },
      spreadsheets: { kind: 'sheet', label: 'Google Sheets', tail: 'preview' },
      forms: { kind: 'form', label: 'Google Forms', tail: 'viewform?embedded=true' }
    };
    const t = typeMap[parts[0]];
    if (t && parts[1] === 'd' && parts[2]) {
      let id = parts[2];
      if (id === 'e' && parts[3]) id = parts[3]; // published forms: /forms/d/e/<id>
      if (!DRIVE_ID.test(id)) return null;
      const base = parts[2] === 'e'
        ? `https://docs.google.com/${parts[0]}/d/e/${id}`
        : `https://docs.google.com/${parts[0]}/d/${id}`;
      return {
        provider: 'gdrive',
        kind: t.kind,
        id,
        url: `${base}/${parts[0] === 'forms' ? 'viewform' : 'edit'}`,
        embedUrl: `${base}/${t.tail}`,
        label: t.label
      };
    }
    return null;
  }

  return null;
}

function driveFile(id, u) {
  if (!DRIVE_ID.test(id)) return null;
  return {
    provider: 'gdrive',
    kind: 'file',
    id,
    url: `https://drive.google.com/file/d/${id}/view`,
    embedUrl: `https://drive.google.com/file/d/${id}/preview`,
    label: 'Google Drive'
  };
}

export function parseResourceUrl(input) {
  const u = normalize(input);
  if (!u) return null;
  return youtube(u) || googleDrive(u);
}

export const SUPPORTED_HINT =
  'รองรับลิงก์ YouTube (watch, youtu.be, shorts, playlist) และ Google Drive (ไฟล์, โฟลเดอร์, Docs, Slides, Sheets, Forms)';
