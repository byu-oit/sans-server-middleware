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
const seconds       = require('./seconds');

module.exports = Log;

function Log(category, config, parent) {

    this.config = config;

    this.category = String(category);

    this.depth = parent ? parent.depth + 1 : 0;

    this.events = [];

    this.index = 0;

    this.parent = parent;

    this.root = parent ? parent.root : this;

    this.start = Date.now();

    this.root.active = this;
}

Log.prototype.event = function(action, message, details) {
    const event = {
        action: 'log',
        category: this.category,
        details: undefined,
        message: '',
        timestamp: Date.now()
    };

    // figure out what parameters were passed in on args
    if (action === undefined) {
        const err = Error('Invalid number of log arguments. Expected at least one string.');
        err.code = 'EPARM';
        throw err;

    } else if (message === undefined) {
        event.message = String(arguments[0]);

    } else if (details === undefined) {
        if (typeof arguments[1] === 'object') {
            event.message = String(arguments[0]);
            event.details = arguments[1];
        } else {
            event.action = String(arguments[0]);
            event.message = String(arguments[1]);
        }

    } else {
        event.action = String(arguments[0]);
        event.message = String(arguments[1]);
        event.details = arguments[2];
    }

    event.active = this.root.active === this;
    event.index = this.root.index++;

    this.events.push(event);

    return event;
};

Log.prototype.nest = function(category) {
    const log = new Log(category, this.config, this);
    this.events.push(log);
    return log;
};

Log.prototype.release = function() {
    this.root.active = this.parent;
    return this.parent;
};

Log.prototype.report = function() {
    const config = this.config;
    const advanced = config.advanced;
    const events = this.events;
    const root = this.root;
    const prefix = advanced ? ' '.repeat(1 + this.depth * 2) + '- ' : ' ';
    const indexLength = String(root.index).length;
    const length = events.length;
    const zeros = ' '.repeat(indexLength);
    let results = [];
    let i;
    let str = '';

    // advanced logging shows category header
    if (advanced) {
        str += '[' +
            (config.index ? ' '.repeat(indexLength) + ' ' : '') +
            seconds(this.start - root.start) + 's] ' +
            ' '.repeat(this.depth * 2) + '> ' + this.category;
        if (this.events.length) str += ' (' + seconds(this.events[this.events.length - 1].timestamp - this.start) + 's)';
        results.push(str);
    }

    // advanced logging matches longest action length
    let longestAction = 0;
    if (advanced) {
        for (i = 0; i < length; i++) {
            if (!(events[i] instanceof Log)) {
                const length = events[i].action.length;
                if (length > longestAction) longestAction = length;
            }
        }
    }

    // produce results array
    for (i = 0; i < length; i++) {
        const event = events[i];
        if (event instanceof Log) {
            results = results.concat(event.report(config));
        } else {
            const index = event.index + zeros;
            let str = '[' +
                (config.index ? index.substr(0, indexLength) + ' ' : '') +
                seconds(event.timestamp - root.start) + 's] ' +
                (event.active ? ' ' : '\u001b[7m!\u001b[0m') +
                prefix +
                event.action + (advanced ? ' '.repeat(longestAction - event.action.length) : '') +
                (event.message ? '  ' + event.message : '');
            if (config.details && event.details !== undefined) {
                const details = typeof event.details === 'object'
                    ? JSON.stringify(event.details, null, 2)
                    : String(event.details);
                str += '\n  ' + details.replace(/\n/g, '\n  ');
            }
            results.push(str);
        }
    }

    return results.join('\n');
};