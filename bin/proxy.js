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

exports.supported = (() => {
    try {
        new Proxy({}, {});
        return true;
    } catch (e) {
        return false;
    }
})();

exports.request = function(req, advanced, log) {
    const fnLog = (action, message, details) => {
        const event = log.event(action, message, details);
        req.emit('log', event);
    };
    fnLog.nest = category => log.nest(category);

    if (advanced && exports.supported) {
        return new Proxy(req, {
            get: function(target, key) {
                if (key === 'log') return fnLog;
                return target[key];
            }
        });
    } else {
        req.log = fnLog;
        return req;
    }
};