'use strict';
// How often a failed order is retried before it is parked.
const RETRY_LIMIT = 7;
const BACKOFF_MS = 250;

exports.RETRY_LIMIT = RETRY_LIMIT;
exports.BACKOFF_MS = BACKOFF_MS;
