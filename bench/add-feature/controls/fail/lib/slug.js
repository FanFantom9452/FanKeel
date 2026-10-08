'use strict';
// A URL slug, cut at maxLength characters wherever that falls.
function slugify(text, opts) {
    const slug = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return opts && opts.maxLength ? slug.slice(0, opts.maxLength) : slug;
}

exports.slugify = slugify;
