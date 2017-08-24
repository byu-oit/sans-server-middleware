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
const Middleware    = require('../index');

describe('sans-server-middleware', () => {
    let m;
    const req = { emit: function() {} };
    const res = { emit: function() {} };

    beforeEach(() => {
        m = new Middleware();
    });

    it('run without middleware', () => {
        return m.run();
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
    })

});