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
const debug     = require('debug')('sans-server:middleware');
const util      = require('util');

module.exports = Middleware;

/**
 * Create a new middleware instance.
 * @params {string} [name='']
 * @returns {Middleware}
 * @constructor
 */
function Middleware(name) {
    if (!(this instanceof Middleware)) return new Middleware(name);
    this.name = name || '';

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
    const name = (hook.name ? hook.name : length + 1);
    const errHandler = hook.length >= 4;

    // create a wrapper around the middleware
    const wrapped = function(err, req, res, next) {

        function done(error) {
            log(req, util.format('middleware-end %s', name));
            next(error);
        }

        if (err && !errHandler) {
            log(req, util.format('skipped %s Hook is not for error handling', name));
            next(err);

        } else if (!err && errHandler) {
            log(req, util.format('skipped %s Hook is for error handling', name));
            next();

        } else {
            try {
                log(req, util.format('middleware-start %s', name));
                errHandler ? hook(err, req, res, done) : hook(req, res, done);
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

function run(middleware, req, res, reverse) {
    if (!middleware._.ordered) middleware.sort();
    const chain = middleware._.ordered.concat();

    return new Promise((resolve, reject) => {
        function next(err) {
            const callback = chain[reverse ? 'pop' : 'shift']();
            if (callback) {
                callback(err, req, res, next);
            } else if (err) {
                log(req, util.format('hook-runner rejected %s', middleware.name));
                reject(err);
            } else {
                log(req, util.format('hook-runner resolved %s', middleware.name));
                resolve();
            }
        }
        log(req, util.format('hook-runner %s %s', reverse ? 'reverse-run' : 'run', middleware.name));
        next();
    });
}

function log(req, message) {

    /**
     * A log event.
     * @event Request#log
     * @type {{ type: string, data: string, timestamp: number} }
     */
    if (req.emit) {
        req.emit('log', {
            category: 'sans-server',
            type: 'middleware',
            data: message,
            timestamp: Date.now()
        });
    } else if (req.log) {
        req.log('middleware', message, {});
    }

    debug(req.id + ' ' + message);
    return this;
}