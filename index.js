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

const isWin = process.platform === 'win32';
const figures = {
    skip: isWin ? '»' : '›',
    start: isWin ? '►' : '▶',
    stop: isWin ? '[]' : '◻'
};

/**
 * Create a new middleware instance.
 * @params {string} [name='']
 * @returns {Middleware}
 * @constructor
 */
function Middleware(name) {
    if (!(this instanceof Middleware)) return new Middleware(name);
    this.name = name;

    Object.defineProperty(this, '_', {
        enumerable: false,
        configurable: false,
        value: {
            length: 0,
            ordered: null,
            weights: new Map()
        }
    });

    /**
     * Returns the length of the middleware.
     * @type {number}
     */
    Object.defineProperty(this, 'length', {
        get: () => this._.length
    });
}

/**
 * Add a middleware function.
 * @param {number} [weight=0]
 * @param {function} hook
 */
Middleware.prototype.add = function(weight, hook) {
    const category = this.name;
    const _ = this._;

    // handle variable parameters
    if (typeof arguments[0] === 'function') {
        hook = arguments[0];
        weight = 0;
    }

    // validate input
    if (typeof hook !== 'function') {
        const err = Error('Invalid hook specified. Expected a function. Received: ' + hook);
        err.code = 'ESHOOK';
        throw err;
    }

    // figure out middleware name and whether it is error middleware
    const length = _.weights.has(weight) ? _.weights.get(weight).length : 0;
    const name = ' ' + (hook.name ? hook.name : length + 1);
    const errHandler = hook.length >= 4;

    // create a wrapper around the middleware
    const wrapped = function(err, req, res, next) {
        const context = this;
        if (err && !errHandler) {
            req.emit('log', {
                action: figures.skip + name,
                category: '[?] ' + category,
                details: { hook: hook, weight: weight },
                message: 'Hook' + name + ' is not for error handling (Weight: ' + weight + ')',
                timestamp: Date.now()
            });
            next(err);

        } else if (!err && errHandler) {
            req.emit('log', {
                action: figures.skip + name,
                category: '[?] ' + category,
                details: { hook: hook, weight: weight },
                message: 'Hook' + name + ' is for error handling (Weight: ' + weight + ')',
                timestamp: Date.now()
            });
            next();

        } else {
            // start timer
            const start = Date.now();

            // define middleware arguments
            const done = function(err) {
                req.emit('log', {
                    action: figures.stop + name,
                    category: '[?] ' + category,
                    details: { hook: hook, weight: weight },
                    message: seconds(Date.now() - start) + 's',
                    timestamp: Date.now()
                });
                next(err);
            };
            const args = [ req, res, done ];
            if (err) args.unshift(err);

            // run middleware
            req.emit('log', {
                action: figures.start + name,
                category: '[?] ' + category,
                details: { hook: hook, weight: weight },
                message: weight,
                timestamp: Date.now()
            });

            try {
                hook.apply(context, args);
            } catch (err) {
                done(err);
            }

        }
    };

    Object.defineProperty(wrapped, 'weight', {
        enumerable: true,
        configurable: false,
        value: weight
    });

    // add for specified weight
    if (!_.weights.has(weight)) _.weights.set(weight, []);
    _.weights.get(weight).push(wrapped);

    // destroy ordered store
    _.ordered = null;

    // increment length
    _.length++;
};

/**
 * Add an iterable of hook functions.
 * @param {*} iterable An array like or iterable object.
 */
Middleware.prototype.from = function(iterable) {
    Array.from(iterable).forEach(hook => {
        this.add(0, hook);
    });
};

/**
 * Run middleware chain in reverse.
 * @param {object} req
 * @param {object} res
 * @param {function} [next]
 * @returns {Promise|undefined}
 */
Middleware.prototype.reverse = function(req, res, next) {
    const promise = run(this, req, res, true);
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
    const promise = run(this, req, res, false);
    if (!next) return promise;
    promise.then(next, next);
};

Middleware.prototype.sort = function() {
    const weights = this._.weights;

    // store sorted data into two dimensional array
    const data = [];
    const keys = Array.from(weights.keys());
    keys.sort();
    keys.forEach(weight => data.push(weights.get(weight)));

    // merge
    const result = [];
    this._.ordered = result.concat.apply(result, data);
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

function run(middleware, req, res, reverse) {
    if (!middleware._.ordered) middleware.sort();
    const chain = middleware._.ordered.concat();
    return new Promise((resolve, reject) => {
        function next(err) {
            const callback = chain[reverse ? 'pop' : 'shift']();
            if (callback) {
                callback(err, req, res, next);
            } else if (err) {
                req.emit('log', {
                    action: middleware.name,
                    category: 'hooks [?]',
                    message: 'rejected',
                    details: {},
                    timestamp: Date.now()
                });
                reject(err);
            } else {
                req.emit('log', {
                    action: middleware.name,
                    category: 'hooks [?]',
                    message: 'resolved',
                    details: {},
                    timestamp: Date.now()
                });
                resolve();
            }
        }
        req.emit('log', {
            action: middleware.name,
            category: 'hooks [?]',
            message: 'start',
            details: {},
            timestamp: Date.now()
        });
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