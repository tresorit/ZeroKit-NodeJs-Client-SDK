/**
 * BSD 3-Clause License

 Copyright (c) 2016, Tresorit
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
 list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
 this list of conditions and the following disclaimer in the documentation
 and/or other materials provided with the distribution.

 * Neither the name of the copyright holder nor the names of its
 contributors may be used to endorse or promote products derived from
 this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

const crypto = require("crypto");
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const req = require("request-promise-native");

/**
 * Loads and returns a separated instance of the sdk.
 * @param serviceUrl The service url of your tenant as displayed on the admin portal
 * @param version The version of the sdk you want to load (only version 4 and 5 is supported right now)
 * @param verboseLogging Turns on verbose logging for debugging. Only for testing, it logs sensitive information to console.
 * @return {zkit_sdk} Returns an instance of the ZeroKit client SDK. For a full documentation see https://tresorit.com/zerokit/docs/
 */
module.exports = function(serviceUrl, version, verboseLogging) {
  if (!serviceUrl || !version) throw new Error("serviceUrl or version is not set");

  let wsk = null;
  const localStorage = new Map();
  const sessionStorage = new Map();

  const zkitContext = vm.createContext({
    verboseLogging,
    setTimeout,
    mockCrypto: {
      cryptoRandomBytes: function(len) {
        return new Uint8Array(crypto.randomBytes(len));
      },
      aesGcmEncrypt: function(data, key, iv, adata, tagLength) {
        if(tagLength < 12)
          throw new Error("TooShortTagLength");

        const cipher = crypto.createCipheriv(`aes-${key.length * 8}-gcm`, new Buffer(key), new Buffer(iv));
        cipher.setAutoPadding();
        if (adata) cipher.setAAD(new Buffer(adata.buffer));
        const cipherText = [cipher.update(new Buffer(data.buffer)), cipher.final(), cipher.getAuthTag()];
        return new Uint8Array(Buffer.concat(cipherText));
      },
      aesGcmDecrypt: function(data, key, iv, adata, tagLength) {
        if(tagLength < 12)
          throw new Error("TooShortTagLength");

        const decipher = crypto.createDecipheriv(`aes-${key.length * 8}-gcm`, new Buffer(key), new Buffer(iv));
        const dataBuff = new Buffer(data.buffer);
        if (adata) decipher.setAAD(new Buffer(adata.buffer));
        decipher.setAuthTag(dataBuff.slice(-tagLength));

        return new Uint8Array(Buffer.concat([decipher.update(dataBuff.slice(0, -tagLength)), decipher.final()]));
      },

      hmacSha256: function(data, password) {
        return crypto.createHmac("sha256", password).update(data).digest();
      },

      pbkdf2HmacSha256: function(password, salt, iterations, size = 32) {
        return new Uint8Array(crypto.pbkdf2Sync(password, salt, iterations, size, "sha256"));
      },

      pbkdf2HmacSha512: function(password, salt, iterations, size = 64) {
        return new Uint8Array(crypto.pbkdf2Sync(password, salt, iterations, size, "sha512"));
      },
      sha256: function(data) {
        return crypto.createHash("sha256").update(data).digest();
      },
      sha512: function(data) {
        return crypto.createHash("sha512").update(data).digest();
      }
    },

    XHRCallback: function (id, method, url, headers, body) {
      const rHeaders = {};
      for (let entry of headers.entries())
        rHeaders[entry[0]] = entry[1];
      const opts = {
        method,
        uri: url,
        headers: rHeaders
      };

      if (body) opts.body = new Buffer(body);

      return req(opts, function (err, response, rbody) {
        const headersStr = Object.keys(response.headers).reduce((o, c) => o + `${c}: ${response.headers[c]}\r\n`, "");
        zkitContext.XHRResolve(id, headersStr, response.statusCode, new Buffer(rbody));
      });
    },
    LogCallback: function (level, args) {
      console.log("Zkit", level, ...args);
    },
    mockPersistenceKeys: {
      getWebSessionKey: function () {
        return wsk;
      },
      removeWebSessionKey: function () {
        return wsk = null;
      },
      setWebSessionKey: function (val) {
        return wsk = val;
      }
    },
    mockLocalStorage: {
      getItem: function (name) {
        return localStorage.get(name);
      },
      setItem: function (name, val) {
        return localStorage.set(name, val);
      },
      removeItem: function (name) {
        return localStorage.delete(name);
      },
      keys: function () {
        return localStorage.keys();
      }
    },
    mockSessionStorage: {
      getItem: function (name) {
        return sessionStorage.get(name);
      },
      setItem: function (name, val) {
        return sessionStorage.set(name, val);
      },
      removeItem: function (name) {
        return sessionStorage.delete(name);
      },
      keys: function () {
        return sessionStorage.keys();
      }
    }
  });

  zkitContext.self = zkitContext;
  zkitContext.window = zkitContext;

  return Promise.all([
    req(`${serviceUrl}/static/v${version}/jsCorePrelude.js`),
    req(`${serviceUrl}/static/v${version}/worker-session-es6.js`),
    req(`${serviceUrl}/static/v${version}/jsCoreWrapper.js`)
  ]).then(function (scripts) {
    scripts.forEach(function (a) {
      return vm.runInContext(a, zkitContext);
    });

    zkitContext.mobileCommands.setBaseURL(serviceUrl + "/");
    return zkitContext.mobileCommands;
  });
};
