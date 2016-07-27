/**
 * Copyright 2016 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License")
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * @module roi
 */
module.exports = exports = {
  get: get,
  post: post,
  put: put,
  del: del,
  exists: exists,
  download: download,
  upload: upload
};

const url = require('url');
const http = require('http');
const fs = require('fs');
const https = require('https');

const maxRedirects = 3;
let redirects = 0;

function hasRedirect (response) {
  return response.statusCode >= 300 && response.statusCode < 400;
}

function goodToGo (response) {
  return response.statusCode < 400;
}

function selectProtocol (options) {
  const uri = url.parse(options.endpoint);
  return uri.protocol === 'http:' ? http : https;
}

function extractHostname (options) {
  return url.parse(options.endpoint).hostname;
}

function extractPath (options) {
  return url.parse(options.endpoint).path;
}

function extractPort (options) {
  return url.parse(options.endpoint).port;
}

function extract (options) {
  options.hostname = extractHostname(options);
  options.port = extractPort(options);
  options.path = extractPath(options);
  return options;
}

function auth (options) {
  if (options.username) {
    return 'Basic ' + new Buffer(options.username + ':' + options.password).toString('base64');
  }
  return '';
}

function addDefaultHeaders (options) {
  options.headers = {
    'Accept': 'application/json,text/plain',
    'Content-type': 'application/json',
    'Authorization': auth(options)
  };
  return options;
}

function maxRedirectsReached () {
  return redirects >= maxRedirects;
}

function validateMaxRedirect (reject) {
  if (maxRedirectsReached()) {
    redirects = 0;
    return reject(new Error('Maximum redirects reached.'));
  } else {
    redirects++;
  }
}

function validateGoodToGo (reject, response) {
  if (!goodToGo(response)) {
    throw new Error(`[${response.statusCode}] - ${response.statusMessage}`);
  }
}

function get (options) {
  const protocol = selectProtocol(options);
  options = extract(options);
  options = addDefaultHeaders(options);
  return new Promise((resolve, reject) => {
    const req = protocol.request(options, (response) => {
      if (goodToGo(response) && !hasRedirect(response)) {
        const body = [];
        response.setEncoding('utf8');
        response.on('data', d => body.push(d));
        response.on('end', () => resolve(body));
      } else {
        validateMaxRedirect(reject);
        validateGoodToGo(reject, response);
        options.endpoint = response.headers.location;
        resolve(get(options));
      }
    }).on('error', e => reject(e));
    req.end();
  });
}

function post (options, data) {
  const protocol = selectProtocol(options);
  options = extract(options);
  options.method = 'POST';
  const jsonData = JSON.stringify(data);
  options = addDefaultHeaders(options);
  options.headers['Content-Length'] = jsonData.length;
  return new Promise((resolve, reject) => {
    const req = protocol.request(options, (response) => {
      if (goodToGo(response) && !hasRedirect(response)) {
        response.on('data', () => (''));
        response.on('end', () => resolve(response));
      } else {
        validateMaxRedirect(reject);
        validateGoodToGo(reject, response);
        options.endpoint = response.headers.location;
        resolve(post(options, data));
      }
    }).on('error', e => reject(e));
    req.write(jsonData);
    req.end();
  });
}

function put (options, data) {
  const protocol = selectProtocol(options);
  options = extract(options);
  options.method = 'PUT';
  const jsonData = JSON.stringify(data);
  options = addDefaultHeaders(options);
  options.headers['Content-Length'] = jsonData.length;
  return new Promise((resolve, reject) => {
    const req = protocol.request(options, (response) => {
      if (goodToGo(response) && !hasRedirect(response)) {
        response.on('data', () => (''));
        response.on('end', () => resolve(response));
      } else {
        validateMaxRedirect(reject);
        validateGoodToGo(reject, response);
        options.endpoint = response.headers.location;
        resolve(put(options, data));
      }
    }).on('error', e => reject(e));
    req.write(jsonData);
    req.end();
  });
}

function del (options) {
  const protocol = selectProtocol(options);
  options = extract(options);
  options = addDefaultHeaders(options);
  options.method = 'DELETE';
  return new Promise((resolve, reject) => {
    const req = protocol.request(options, (response) => {
      if (goodToGo(response) && !hasRedirect(response)) {
        response.on('data', d => (''));
        response.on('end', () => resolve(response));
      } else {
        validateMaxRedirect(reject);
        validateGoodToGo(reject, response);
        options.endpoint = response.headers.location;
        resolve(del(options));
      }
    }).on('error', e => reject(e));
    req.end();
  });
}

function exists (options) {
  const protocol = selectProtocol(options);
  options = extract(options);
  options.method = 'HEAD';
  return new Promise((resolve, reject) => {
    const req = protocol.request(options, (response) => {
      if (goodToGo(response) && !hasRedirect(response)) {
        response.on('data', d => (''));
        response.on('end', () => resolve(response));
      } else {
        validateMaxRedirect(reject);
        validateGoodToGo(reject, response);
        options.endpoint = response.headers.location;
        resolve(exists(options));
      }
    }).on('error', e => reject(e));
    req.end();
  });
}

function download (options, file) {
  const protocol = selectProtocol(options);
  options = extract(options);
  options = addDefaultHeaders(options);
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(file);
    const req = protocol.request(options, (response) => {
      if (goodToGo(response) && !hasRedirect(response)) {
        response.pipe(stream);
        stream.on('finish', () => {
          resolve(response);
          stream.close();
        });
      } else {
        validateMaxRedirect(reject);
        validateGoodToGo(reject, response);
        options.endpoint = response.headers.location;
        resolve(download(options, file));
      }
    }).on('error', e => reject(e));
    req.end();
  });
}

function upload (options, file) {
  const protocol = selectProtocol(options);
  options = extract(options);
  options.method = 'POST';
  options = addDefaultHeaders(options);
  options.headers.filename = file;
  return new Promise((resolve, reject) => {
    const req = protocol.request(options, (response) => {
      if (goodToGo(response) && !hasRedirect(response)) {
        const body = [];
        response.on('data', d => body.push(d));
        response.on('end', () => resolve(body.join('')));
      } else {
        validateMaxRedirect(reject);
        validateGoodToGo(reject, response);
        options.endpoint = response.headers.location;
        resolve(upload(options, file));
      }
    }).on('error', e => reject(e));
    const stream = fs.ReadStream(file);
    stream.pipe(req);
    stream.on('close', (res) => {
      req.end();
    });
  });
}
