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
const expect        = require('chai').expect;
const EventEmitter  = require('events');
const Middleware    = require('../index');
const seconds       = require('../bin/seconds');

function Request() {}
Request.prototype = Object.create(EventEmitter.prototype);
Request.prototype.log = function(action, message, details) {
    this.emit('log', {
        action: action,
        category: null,
        details: details,
        message: message,
        timestamp: Date.now()
    });
};

describe('sans-server-middleware', () => {
    let m;
    let req = {};
    let res = {};

    beforeEach(() => {
        req = new Request();
        res = {};
        m = new Middleware('test-middleware');
    });

    it('run without middleware', () => {
        return m.run(req, res);
    });

    it('does not require new keyword', () => {
        const n = Middleware();
        expect(n).to.be.an.instanceOf(Middleware);
    });

    it('will only add functons', () => {
        expect(() => m.add(5)).to.throw(/Invalid hook specified/);
    });

    it('run with next() middleware', () => {
        let s = '';
        m.add((req, res, next) => {
            s += 'a';
            next();
        });
        return m.run(req, res)
            .then(() => expect(s).to.equal('a'));
    });

    it('run with next(err) middleware', () => {
        let s = '';
        m.add((req, res, next) => {
            s += 'a';
            next(Error('Success'));
        });
        return m.run(req, res)
            .then(() => { throw Error('Fail') })
            .catch(err => expect(err.message).to.match(/Success/))
            .then(() => expect(s).to.equal('a'));
    });

    it('run with error middleware', () => {
        let s = '';
        m.add(function named(req, res, next) {
            s += 'a';
            next(Error('Success'));
        });
        m.add((req, res, next) => { // skip this because of error
            s += 'b';
            next();
        });
        m.add((err, req, res, next) => { // resolves error
            s += 'c';
            next();
        });
        m.add((req, res, next) => {
            s += 'd';
            next();
        });
        return m.run(req, res)
            .then(() => {
                expect(s).to.equal('acd');
            });
    });

    it('throw synchronous error', () => {
        let s = '';
        m.add((req, res, next) => {
            s += 'a';
            throw Error('');
        });
        m.add((req, res, next) => { // skip this because of error
            s += 'b';
            next();
        });
        m.add((err, req, res, next) => { // resolves error
            s += 'c';
            next();
        });
        m.add((req, res, next) => {
            s += 'd';
            next();
        });
        return m.run(req, res)
            .then(() => {
                expect(s).to.equal('acd');
            });
    });

    it('error skip non error middleware', () => {
        let s = '';
        m.add((req, res, next) => {
            s += 'a';
            next();
        });
        m.add((req, res, next) => {
            s += 'b';
            throw Error('');
        });
        m.add((req, res, next) => { // skip because has error
            s += 'c';
            next();
        });
        m.add((err, req, res, next) => {
            s += 'd';
            next();
        });
        return m.run(req, res)
            .then(() => {
                expect(s).to.equal('abd');
            });
    });

    it('callback', done => {
        let s = '';
        m.add((req, res, next) => {
            s += 'a';
            next();
        });
        m.run(req, res, function(err) {
            expect(err).to.be.undefined;
            expect(s).to.equal('a');
            done();
        });
    });

    it('callback with error', done => {
        let s = '';
        m.add((req, res, next) => {
            s += 'a';
            next(Error('Pass'));
        });
        m.run(req, res, function(err) {
            expect(err.message).to.equal('Pass');
            done();
        });
    });

    it('reverse', () => {
        let s = '';
        m.add((req, res, next) => {
            s += 'a';
            next();
        });
        m.add((req, res, next) => {
            s += 'b';
            next();
        });
        m.add((err, req, res, next) => { // skip because not error
            s += 'c';
            next();
        });
        m.add((req, res, next) => {
            s += 'd';
            next();
        });
        return m.reverse(req, res)
            .then(() => {
                expect(s).to.equal('dba');
            });
    });

    it('reverse callback', done => {
        let s = '';
        m.add((req, res, next) => {
            s += 'a';
            next();
        });
        m.reverse(req, res, function(err) {
            expect(err).to.be.undefined;
            expect(s).to.equal('a');
            done();
        });
    });

    it('slow', () => {
        m.add((req, res, next) => {
            setTimeout(next, 1005);
        });
        return m.run(req, res);
    });

    it('from', () => {
        let s = '';
        const ar = [];
        ar.push((req, res, next) => {
            s += 'a';
            next();
        });
        ar.push((req, res, next) => {
            s += 'b';
            next();
        });
        m.from(ar);
        return m.run(req, res)
            .then(() => expect(s).to.equal('ab'));
    });

    it('has length', () => {
        m.add((req, res, next) => {});
        m.add((req, res, next) => {});
        m.add((err, req, res, next) => {});
        expect(m.length).to.equal(3);
    });

    describe('weight', () => {
        let m;

        beforeEach(() => {
            m = new Middleware();
        });

        it('run in weight order', () => {
            let s = '';
            m.add(100, (req, res, next) => {
                s += 'a';
                next();
            });
            m.add(100, (req, res, next) => {
                s += 'b';
                next();
            });
            m.add(0, (req, res, next) => {
                s += 'c';
                next();
            });
            m.add(-10, (req, res, next) => {
                s += 'd';
                next();
            });
            return m.run(req, res).then(() => expect(s).to.equal('dcab'));
        });

        it('run in reverse weight order', () => {
            let s = '';
            m.add(100, (req, res, next) => {
                s += 'a';
                next();
            });
            m.add(100, (req, res, next) => {
                s += 'b';
                next();
            });
            m.add(0, (req, res, next) => {
                s += 'c';
                next();
            });
            m.add(-10, (req, res, next) => {
                s += 'd';
                next();
            });
            return m.reverse(req, res).then(() => expect(s).to.equal('bacd'));
        });

    });

    describe('logs', () => {

        it('run with next() middleware', () => {
            const mw = new Middleware('sub-middleware');

            mw.add(function secondary(req, res, next) {
                setTimeout(function() {
                    s += 'c';
                    req.log('abc', 'wera');
                    next();
                }, 50);
            });

            req.on('log', event => {
                console.log(JSON.stringify(event, null, 2));
            });
            let s = '';
            m.add(function mwFunction1(req, res, next) {
                s += 'a';
                req.log('run', 'something');
                next();
            });
            m.add(function mwFunction2(req, res, next) {
                s += 'b';
                req.log('sync', 'in sync');
                mw.run(req, res, function(err) {
                    req.log('sync', 'back in');
                    next(err);
                });
                req.log('sync', 'out of sync');
            });
            m.add(function errorFunction(err, req, res, next) {
                next();
            });
            m.add(function mwFunction3(req, res, next) {
                s += 'd';
                req.log('finish', 'other');
                next();
            });

            const start = Date.now();
            const p = m.run(req, res);
            return p
                .then(() => {
                    expect(s).to.equal('abcd');
                    console.log(Date.now() - start);
                    console.log(p.log.report());
                });
        });

    });

    describe('seconds', () => {

        it('0 ms', () => {
            expect(seconds(0)).to.equal('0.000');
        });

        it('1 ms', () => {
            expect(seconds(1)).to.equal('0.001');
        });

        it('10 ms', () => {
            expect(seconds(10)).to.equal('0.010');
        });

        it('100 ms', () => {
            expect(seconds(100)).to.equal('0.100');
        });

        it('1000 ms', () => {
            expect(seconds(1000)).to.equal('1.000');
        });

        it('10000 ms', () => {
            expect(seconds(10000)).to.equal('10.00');
        });

        it('100000 ms', () => {
            expect(seconds(100000)).to.equal('100.0');
        });

        it('1000000 ms', () => {
            expect(seconds(1000000)).to.equal('1000 ');
        });

        it('9999000 ms', () => {
            expect(seconds(9999000)).to.equal('9999 ');
        });

        it('10000000 ms', () => {
            expect(seconds(10000000)).to.equal('9999+');
        });

        it('11 ms', () => {
            expect(seconds(11)).to.equal('0.011');
        });

        it('123 ms', () => {
            expect(seconds(123)).to.equal('0.123');
        });

        it('1234 ms', () => {
            expect(seconds(1234)).to.equal('1.234');
        });

        it('12345 ms', () => {
            expect(seconds(12345)).to.equal('12.35');
        });

        it('123456 ms', () => {
            expect(seconds(123456)).to.equal('123.5');
        });

        it('1234567 ms', () => {
            expect(seconds(1234567)).to.equal('1235 ');
        });

        it('12345678 ms', () => {
            expect(seconds(12345678)).to.equal('9999+');
        });

    });

});