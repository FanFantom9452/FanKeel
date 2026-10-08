'use strict';
// A URL slug: lower case, runs of anything but a-z and 0-9 become one hyphen,
// and no hyphen at either end. With `maxLength`, at most that many characters,
// cut at the last whole word that fits; a first word longer than that is cut
// inside the word.
function slugify(text, opts) {
    const slug = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const max = opts && opts.maxLength;
    if (!max || slug.length <= max) return slug;
    const head = slug.slice(0, max);
    if (slug[max] === '-') return head;
    const at = head.lastIndexOf('-');
    return at > 0 ? head.slice(0, at) : head;
}

exports.slugify = slugify;
