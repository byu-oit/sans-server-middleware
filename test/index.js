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

function Request() {
    this.id = String(Math.round(100000 * Math.random()));
}
Request.prototype = Object.create(EventEmitter.prototype);
Request.prototype.log = function(action, message, details) {};

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



});