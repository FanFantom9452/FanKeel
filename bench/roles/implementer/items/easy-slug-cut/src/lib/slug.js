'use strict';
// A URL slug: lower case, runs of anything but a-z and 0-9 become one hyphen,
// and no hyphen at either end.
function slugify(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

exports.slugify = slugify;
