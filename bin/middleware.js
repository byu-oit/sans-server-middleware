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
const Log       = require('./log');
const proxy     = require('./proxy');

module.exports = Middleware;

/**
 * Create a new middleware instance.
 * @params {string} [name='']
 * @params {object} [config]
 * @returns {Middleware}
 * @constructor
 */
function Middleware(name, config) {
    if (!(this instanceof Middleware)) return new Middleware(name);
    this.name = name || '';

    config = !config || typeof config !== 'object' ? {} : JSON.parse(JSON.stringify(config));
    if (!config.log || typeof config.log !== 'object') config.log = {};
    if (!config.log.hasOwnProperty('advanced')) config.log.advanced = true;
    if (!config.log.hasOwnProperty('index')) config.log.index = false;
    if (!config.log.hasOwnProperty('details')) config.log.details = false;
    if (!proxy.supported) config.log.advanced = false;

    Object.defineProperty(this, '_', {
        enumerable: false,
        configurable: false,
        value: {
            config: config,
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
    const advanced = this._.config.log.advanced;

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
    const wrapped = function(parentLog, err, req, res, next) {
        const log = parentLog.nest('middleware ' + name);
        const r = proxy.request(req, advanced, log);

        function done(err) {
            if (!advanced) log.event('middleware end', name);
            log.release();
            next(err);
        }

        if (err && !errHandler) {
            log.event('skipped', 'Hook ' + (advanced ? '' : name + ' ') + 'is not for error handling');
            next(err);

        } else if (!err && errHandler) {
            log.event('skipped', 'Hook ' + (advanced ? '' : name + ' ') + 'is for error handling');
            next();

        } else {
            try {
                if (!advanced) log.event('middleware start', name);
                errHandler ? hook(err, r, res, done) : hook(r, res, done);
            } catch (err) {
                next(err);
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
    const config = middleware._.config;
    const chain = middleware._.ordered.concat();
    const isRoot = !req.log.nest;
    const log = isRoot
        ? new Log('hook-runner', config.log)
        : req.log.nest('hook-runner');
    const prefix = config.log.advanced ? '' : 'hook-';

    return new Promise((resolve, reject) => {
        function next(err) {
            const callback = chain[reverse ? 'pop' : 'shift']();
            if (callback) {
                callback(log, err, req, res, next);
            } else if (err) {
                log.event(prefix + 'rejected', middleware.name);
                log.release();
                if (isRoot) req.emit('log-report', log.report());
                reject(err);
            } else {
                log.event(prefix + 'resolved', middleware.name);
                log.release();
                if (isRoot) req.emit('log-report', log.report());
                resolve();
            }
        }
        log.event(reverse ? prefix + 'reverse-run' : prefix + 'run', middleware.name);
        next();
    });
}