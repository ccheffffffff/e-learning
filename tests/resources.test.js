import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResourceUrl } from '../server/resources.js';

test('parses standard YouTube watch URLs', () => {
  const r = parseResourceUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share');
  assert.equal(r.provider, 'youtube');
  assert.equal(r.kind, 'video');
  assert.equal(r.id, 'dQw4w9WgXcQ');
  assert.match(r.embedUrl, /^https:\/\/www\.youtube\.com\/embed\/dQw4w9WgXcQ\?/);
});

test('parses youtu.be, shorts, embed, live and timestamp variants', () => {
  assert.equal(parseResourceUrl('https://youtu.be/dQw4w9WgXcQ').id, 'dQw4w9WgXcQ');
  assert.equal(parseResourceUrl('youtu.be/dQw4w9WgXcQ').id, 'dQw4w9WgXcQ');
  assert.equal(parseResourceUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ').id, 'dQw4w9WgXcQ');
  assert.equal(parseResourceUrl('https://www.youtube.com/embed/dQw4w9WgXcQ').id, 'dQw4w9WgXcQ');
  assert.equal(parseResourceUrl('https://m.youtube.com/live/dQw4w9WgXcQ').id, 'dQw4w9WgXcQ');
  const t = parseResourceUrl('https://youtu.be/dQw4w9WgXcQ?t=1m30s');
  assert.match(t.embedUrl, /start=90/);
  const t2 = parseResourceUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=45');
  assert.match(t2.embedUrl, /start=45/);
});

test('parses YouTube playlists', () => {
  const r = parseResourceUrl('https://www.youtube.com/playlist?list=PLabc123DEF456');
  assert.equal(r.kind, 'playlist');
  assert.match(r.embedUrl, /videoseries\?list=PLabc123DEF456/);
});

test('parses Google Drive file links into preview embeds', () => {
  const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz_-123';
  for (const u of [
    `https://drive.google.com/file/d/${id}/view?usp=sharing`,
    `https://drive.google.com/file/d/${id}/preview`,
    `https://drive.google.com/open?id=${id}`,
    `https://drive.google.com/uc?id=${id}&export=download`
  ]) {
    const r = parseResourceUrl(u);
    assert.equal(r.provider, 'gdrive', u);
    assert.equal(r.kind, 'file', u);
    assert.equal(r.embedUrl, `https://drive.google.com/file/d/${id}/preview`, u);
  }
});

test('parses Google Drive folders and Docs/Slides/Sheets/Forms', () => {
  const folder = parseResourceUrl('https://drive.google.com/drive/u/0/folders/1FolderIdXYZ12345?usp=sharing');
  assert.equal(folder.kind, 'folder');
  assert.match(folder.embedUrl, /embeddedfolderview\?id=1FolderIdXYZ12345/);

  const doc = parseResourceUrl('https://docs.google.com/document/d/1DocIdXYZ1234567/edit#heading=h.1');
  assert.equal(doc.kind, 'doc');
  assert.equal(doc.embedUrl, 'https://docs.google.com/document/d/1DocIdXYZ1234567/preview');

  const slides = parseResourceUrl('https://docs.google.com/presentation/d/1SlideIdXYZ123456/edit?usp=sharing');
  assert.equal(slides.kind, 'slides');
  assert.match(slides.embedUrl, /\/embed\?start=false/);

  const sheet = parseResourceUrl('https://docs.google.com/spreadsheets/d/1SheetIdXYZ123456/edit#gid=0');
  assert.equal(sheet.kind, 'sheet');
  assert.match(sheet.embedUrl, /\/preview$/);

  const form = parseResourceUrl('https://docs.google.com/forms/d/e/1FAIpQLSformIdXYZ/viewform');
  assert.equal(form.kind, 'form');
  assert.match(form.embedUrl, /\/d\/e\/1FAIpQLSformIdXYZ\/viewform\?embedded=true$/);
});

test('rejects unsupported or malformed links', () => {
  assert.equal(parseResourceUrl('https://example.com/video.mp4'), null);
  assert.equal(parseResourceUrl('https://vimeo.com/12345'), null);
  assert.equal(parseResourceUrl('https://www.youtube.com/watch?v=short'), null);
  assert.equal(parseResourceUrl('https://drive.google.com/file/d//view'), null);
  assert.equal(parseResourceUrl('not a url at all'), null);
  assert.equal(parseResourceUrl(''), null);
  assert.equal(parseResourceUrl(null), null);
  // look-alike hosts must not pass
  assert.equal(parseResourceUrl('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(parseResourceUrl('https://notdrive.google.com/file/d/1AbCdEfGhIjKlMnOp/view'), null);
});
