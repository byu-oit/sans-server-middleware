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
const proxy         = require('../bin/proxy');
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

    it('run twice', () => {
        let count = 0;
        const m = new Middleware('test middleware', { log: { advanced: false } });
        m.add((req, res, next) => next(Error('')));
        m.add((req, res, next) => next());
        m.add((err, req, res, next) => next());
        m.add((req, res, next) => {
            count++;
            next();
        });
        return m.run(req, res)
            .then(() => m.run(req, res))
            .then(() => {
                expect(count).to.equal(2);
            })
    });

    it('internal end with rejection passes to external', () => {
        const err = Error();
        const m2 = new Middleware('error producer');
        m2.add((req, res, next) => {
            next(err);
        });
        m.add((req, res, next) => {
            m2.run(req, res, e => {
                expect(e).to.equal(err);
                next();
            });
        });
        return m.run(req, res);
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

        function addMiddlewares(outer, inner) {

            inner.add(function secondary(req, res, next) {
                setTimeout(function() {
                    req.log('abc', 'wera');
                    next();
                }, 50);
            });

            outer.add(function mwFunction1(req, res, next) {
                req.log('do');
                req.log('details', {});
                req.log('log', 'details 2', 1);
                next();
            });
            outer.add(function mwFunction2(req, res, next) {
                req.log('sync', 'in sync');
                inner.reverse(req, res, function(err) {
                    req.log('sync', 'back in');
                    next(err);
                });
                req.log('sync', 'out of sync');
            });
            outer.add(function errorFunction(err, req, res, next) {
                next();
            });
            outer.add(function mwFunction3(req, res, next) {
                req.log('finish', 'other');
                next();
            });
        }

        it('normal', () => {
            const config = { log: { index: true, advanced: false } };
            const outer = new Middleware('test-middleware', config);
            const inner = new Middleware('sub-middleware', config);
            addMiddlewares(outer, inner);

            let report;
            req.on('log-report', r => report = r);

            return outer.run(req, res).then(() => {
                console.log(report);
                const lines = report
                    .split('\n')
                    .map(line => line.split('] ')[1].replace(/\([\S\s]+?\)$/, '').replace(/ +$/, '').replace(/\u001b\[\d+m/g, ''));

                expect(lines[0]).to.equal ('  hook-run  test-middleware');
                expect(lines[1]).to.equal ('  middleware start  mwFunction1');
                expect(lines[2]).to.equal ('  log  do');
                expect(lines[3]).to.equal ('  log  details');
                expect(lines[4]).to.equal ('  log  details 2');
                expect(lines[5]).to.equal ('  middleware end  mwFunction1');
                expect(lines[6]).to.equal ('  middleware start  mwFunction2');
                expect(lines[7]).to.equal ('  sync  in sync');
                expect(lines[8]).to.equal ('  hook-reverse-run  sub-middleware');
                expect(lines[9]).to.equal ('  middleware start  secondary');
                expect(lines[10]).to.equal('  sync  out of sync');
                expect(lines[11]).to.equal('  abc  wera');
                expect(lines[12]).to.equal('  middleware end  secondary');
                expect(lines[13]).to.equal('! sync  back in');
                expect(lines[14]).to.equal('  hook-resolved  sub-middleware');
                expect(lines[15]).to.equal('  middleware end  mwFunction2');
                expect(lines[16]).to.equal('  skipped  Hook errorFunction is for error handling');
                expect(lines[17]).to.equal('  middleware start  mwFunction3');
                expect(lines[18]).to.equal('  finish  other');
                expect(lines[19]).to.equal('  middleware end  mwFunction3');
                expect(lines[20]).to.equal('  hook-resolved  test-middleware');
            });
        });

        it('advanced', () => {
            const config = { log: { index: true, advanced: true } };
            const outer = new Middleware('test-middleware', config);
            const inner = new Middleware('sub-middleware', config);
            addMiddlewares(outer, inner);

            let report;
            req.on('log-report', r => report = r);

            return outer.run(req, res).then(() => {
                console.log(report);
                const lines = report
                    .split('\n')
                    .map(line => line.split('] ')[1].replace(/\([\S\s]+?\)$/, '').replace(/ +$/, '').replace(/\u001b\[\d+m/g, ''));

                expect(lines[0]).to.equal ('> hook-runner');
                expect(lines[1]).to.equal ('  - run       test-middleware');
                expect(lines[2]).to.equal ('  > middleware mwFunction1');
                expect(lines[3]).to.equal ('    - log  do');
                expect(lines[4]).to.equal ('    - log  details');
                expect(lines[5]).to.equal ('    - log  details 2');
                expect(lines[6]).to.equal ('  > middleware mwFunction2');
                expect(lines[7]).to.equal ('    - sync  in sync');
                expect(lines[8]).to.equal ('    > hook-runner');
                expect(lines[9]).to.equal ('      - reverse-run  sub-middleware');
                expect(lines[10]).to.equal('      > middleware secondary');
                expect(lines[11]).to.equal('        - abc  wera');
                expect(lines[12]).to.equal('      - resolved     sub-middleware');
                expect(lines[13]).to.equal('!   - sync  out of sync');
                expect(lines[14]).to.equal('    - sync  back in');
                expect(lines[15]).to.equal('  > middleware errorFunction');
                expect(lines[16]).to.equal('    - skipped  Hook is for error handling');
                expect(lines[17]).to.equal('  > middleware mwFunction3');
                expect(lines[18]).to.equal('    - finish  other');
                expect(lines[19]).to.equal('  - resolved  test-middleware');
            });
        });

        it('proxy not supported', () => {
            const supported = proxy.supported;
            proxy.supported = false;

            const config = { log: { index: true, advanced: false, details: true } };
            const outer = new Middleware('test-middleware', config);
            const inner = new Middleware('sub-middleware', config);
            addMiddlewares(outer, inner);

            let report;
            req.on('log-report', r => report = r);

            return outer.run(req, res).then(() => {
                proxy.supported = supported;

                console.log(report);
                const lines = report
                    .split('\n')
                    .map(line => {
                        const ar = line.split('] ');
                        return ar[1]
                            ? ar[1].replace(/\([\S\s]+?\)$/, '').replace(/ +$/, '').replace(/\u001b\[\d+m/g, '')
                            : ar[0];
                    });

                expect(lines[0]).to.equal ('  hook-run  test-middleware');
                expect(lines[1]).to.equal ('  middleware start  mwFunction1');
                expect(lines[2]).to.equal ('  log  do');
                expect(lines[3]).to.equal ('  log  details');
                expect(lines[4]).to.equal ('  {}');
                expect(lines[5]).to.equal ('  log  details 2');
                expect(lines[6]).to.equal ('  1');
                expect(lines[7]).to.equal ('  middleware end  mwFunction1');
                expect(lines[8]).to.equal ('  middleware start  mwFunction2');
                expect(lines[9]).to.equal ('  sync  in sync');
                expect(lines[10]).to.equal ('  hook-reverse-run  sub-middleware');
                expect(lines[11]).to.equal ('  middleware start  secondary');
                expect(lines[12]).to.equal ('  sync  out of sync');
                expect(lines[13]).to.equal ('  abc  wera');
                expect(lines[14]).to.equal('  middleware end  secondary');
                expect(lines[15]).to.equal('! sync  back in');
                expect(lines[16]).to.equal('  hook-resolved  sub-middleware');
                expect(lines[17]).to.equal('  middleware end  mwFunction2');
                expect(lines[18]).to.equal('  skipped  Hook errorFunction is for error handling');
                expect(lines[19]).to.equal('  middleware start  mwFunction3');
                expect(lines[20]).to.equal('  finish  other');
                expect(lines[21]).to.equal('  middleware end  mwFunction3');
                expect(lines[22]).to.equal('  hook-resolved  test-middleware');
            });
        });

        it('log missing action', () => {
            m.add((req, res, next) => {
                expect(() => req.log()).to.throw(/Invalid number of log arguments/);
                next();
            });
            return m.run(req, res);
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