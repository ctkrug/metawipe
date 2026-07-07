// Download-name helper for the wiped file.
//
// Pure string logic (no DOM) so it can be unit-tested directly: given the
// original photo's name, produce the "-clean" variant, always ending in a
// JPEG extension.

/**
 * Derive the cleaned download name from an original filename.
 *   photo.jpg      -> photo-clean.jpg
 *   IMG_1234.JPEG  -> IMG_1234-clean.JPEG   (original case + extension kept)
 *   snapshot       -> snapshot-clean.jpg    (no extension -> add one)
 * @param {string} name
 * @returns {string}
 */
export function cleanFilename(name) {
  const base = (name || 'photo').trim() || 'photo';
  if (/\.jpe?g$/i.test(base)) {
    return base.replace(/(\.jpe?g)$/i, '-clean$1');
  }
  return `${base}-clean.jpg`;
}
