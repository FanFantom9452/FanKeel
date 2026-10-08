'use strict';
// Starts the order server.
const http = require('node:http');

const DEFAULT_PORT = 8417;

function listen(port) {
    return http.createServer().listen(port || DEFAULT_PORT);
}

exports.listen = listen;
