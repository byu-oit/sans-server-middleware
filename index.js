/**
 *  @license
 *    Copyright 2017 Brigham Young University
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 **/
'use strict';

module.exports = Middleware;

/**
 * Create a new middleware instance.
 * @returns {Middleware}
 * @constructor
 */
function Middleware() {
    if (!(this instanceof Middleware)) return new Middleware();
    this.store = [];
}

/**
 * Add a middleware function.
 * @param {function} hook
 */
Middleware.prototype.add = function(hook) {
    const store = this.store;

    // validate input
    if (typeof hook !== 'function') {
        const err = Error('Invalid hook specified. Expected a function. Received: ' + hook);
        err.code = 'ESHOOK';
        throw err;
    }

    // figure out middleware name and whether it is error middleware
    const name = 'HOOK-' + (hook.name ? hook.name.toUpperCase() : store.length + 1);
    const errHandler = hook.length >= 4;

    // create a wrapper around the middleware
    const wrapped = function(err, req, res, next) {
        const context = this;
        if (err && !errHandler) {
            req.emit('log', {
                action: 'skip',
                category: name,
                details: { hook: hook },
                message: 'Has error and hook is not error handling'
            });
            next(err);

        } else if (!err && errHandler) {
            req.emit('log', {
                action: 'skip',
                category: name,
                details: { hook: hook },
                message: 'No error and hook is for error handling'
            });
            next();

        } else {
            // start timer
            const start = Date.now();

            // define middleware arguments
            const done = function(err) {
                req.emit('log', {
                    action: 'end',
                    category: name,
                    details: { hook: hook },
                    message: 'Run duration: ' + seconds(Date.now() - start)
                });
                next(err);
            };
            const args = [ req, res, done ];
            if (err) args.unshift(err);

            // run middleware
            req.emit('log', { action: 'start', category: name, details: { hook: hook }, message: '' });
            try {
                hook.apply(context, args);
            } catch (err) {
                done(err);
            }

        }
    };

    store.push(wrapped);
};

/**
 * Run middleware chain in reverse.
 * @param {object} req
 * @param {object} res
 * @param {function} [next]
 * @returns {Promise|undefined}
 */
Middleware.prototype.reverse = function(req, res, next) {
    const promise = run(this.store, req, res, true);
    if (!next) return promise;
    promise.then(next, next);
};

/**
 * Run middleware chain.
 * @param {object} req
 * @param {object} res
 * @param {function} [next]
 * @returns {Promise|undefined}
 */
Middleware.prototype.run = function(req, res, next) {
    const promise = run(this.store, req, res, false);
    if (!next) return promise;
    promise.then(next, next);
};

function addCharacters(value, ch, after, length) {
    let result = '' + value;
    while (result.length < length) {
        if (after) {
            result += ch;
        } else {
            result = ch + result;
        }
    }
    return result;
}

function run(store, req, res, reverse) {
    const chain = store.slice(0);
    return new Promise((resolve, reject) => {
        function next(err) {
            const callback = chain[reverse ? 'pop' : 'shift']();
            if (callback) {
                callback(err, req, res, next);
            } else if (err) {
                reject(err);
            } else {
                resolve();
            }
        }
        next();
    });
}

/**
 * Get formatted time in seconds.
 * @param {number} milliseconds
 * @returns {string}
 */
function seconds(milliseconds) {
    let seconds = milliseconds / 1000;

    if (seconds > 9999) return '9999+';
    if (seconds > 999) return Math.round(seconds) + ' ';

    const numeral = Math.floor(seconds);
    const decimalLen = 4 - numeral.toString().length;
    const thousandths = Math.round((seconds - numeral) * Math.pow(10, decimalLen));
    const decimal = addCharacters(thousandths.toString(), '0', numeral > 0, decimalLen);

    return numeral + '.' + decimal;
}