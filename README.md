[![Build Status](https://travis-ci.org/byu-oit/sans-server-middleware.svg?branch=master)](https://travis-ci.org/byu-oit/sans-server-middleware)
[![Coverage Status](https://coveralls.io/repos/github/byu-oit/sans-server-middleware/badge.svg?branch=master)](https://coveralls.io/github/byu-oit/sans-server-middleware?branch=master)

# sans-server-middleware

A [sans-server](https://www.npmjs.com/package/sans-server) hook runner.

This package is used by [sans-server](https://www.npmjs.com/package/sans-server) and [sans-server-router](https://www.npmjs.com/package/sans-server-router) to enact hooks.

**Example**

```js
const Middleware = require('sans-server-middleware');
const SansServer = require('sans-server');

const middleware = new Middleware();

// add normal middleware
middleware.add(function a(req, res, next) {
    req.str = 'a';
});

// add normal middleware - produces error
middleware.add(function b(req, res, next) {
    req.str += 'b';
    next(Error('Failure'));
});

// add normal middleware - skipped because of error before
middleware.add(function c(req, res, next) {
    req.str += 'c';
});

// add error middleware - resolves error
middleware.add(function d(err, req, res, next) {
    req.str += 'd';
    next();
});

// add normal middleware
middleware.add(function e(req, res, next) {
    req.str = 'e';
});

// run the middleware
SansServer.use(function(req, res, next) {
    middleware.run(req, res, next);
});


```

## Middleware `constructor`

This constructor is used gather and run hooks that are added to it.

**Signature** **<code>Middleware() : Middleware</code>**

**Methods**

- [add](#middlewareadd) - Add a hook function.
- [from](#middlewarefrom) - Add an array-like or iterable of hook functions.
- [reverse](#middlewarereverse) - Run the added middleware functions in reverse order.
- [run](#middlewarerun) - Run the added middleware functions.

**Properties**

- [length](#middlewarelength) - Get the number of hooks attached to the instance.

**Parameters** None

**Returns** a [middleware](#sansservermiddleware) instance.

**Example**

```js
const Middleware = require('sans-server-middleware');

const middleware = new Middleware();

middleware.add(function myHook(req, res, next) {
    // do something ...
    next();
});
```

## Middleware#add

Add a middleware hook.

**Signature** **<code>Middleware#add( hook ) : undefined</code>**

**Parameters**

| Parameter | Description | Type | Default |
| --- | --- | --- | --- |
| hook | A [middleware function](#hooks-and-middleware). Naming the function will improve log readability. | `function` | |

**Returns** undefined

**Example**

```js
const Middleware = require('sans-server-middleware');

const middleware = new Middleware();

middleware.add(function myHook(req, res, next) {
    // do something ...
    next();
});
```

## Middleware#from

Add middleware from an array-like object or an iterable. Each item must be a function.

**Signature** **<code>Middleware#from( iterable ) : undefined</code>**

**Parameters**

| Parameter | Description | Type | Default |
| --- | --- | --- | --- |
| iterable | An array-like object or iterable | `Array.<function>` | |

**Returns** undefined

**Example**

```js
const Middleware = require('sans-server-middleware');

const middleware = new Middleware();

const ar = [];
ar.push(function myHook(req, res, next) {
    // do something ...
    next();
});

middleware.from(ar);
```

## Middleware#length

Get the number of hooks that have been added to the instance.

**Signature** **<code>Middleware#length : number</code>**

**Type** `number`

**Example**

```js
const SansServer = require('sans-server');
const Middleware = SansServer.Middleware;

const middleware = new Middleware();

middleware.add(function(req, res, next) {
    // do something ...
    next();
});

console.log(middleware.length);     // 1
```

## Middleware#reverse

Run through the added hooks in reverse order.

**Signature** **<code>Middleware#reverse( req, res [, next ]) : Promise|undefined</code>**

**Parameters** 

| Parameter | Description | Type | Default |
| --- | --- | --- | --- |
| req | The [sans-server](#) request object | `Request` | |
| res | The [sans-server](#) response object | `Request` | |
| next | A function to call once all hooks have been run. It will receive an Error as a parameter if there was an unresolved error while running the middleware. If this function is omitted then a promise will be returned  | `function` | `undefined` |

**Returns** a Promise if the `next` parameter was not provided. The promise resolves if there are no unresolved errors while running the middleware, otherwise it rejects with the error reason. If the `next` parameter was provided then `undefined` is returned instead.

**Example**

```js
const SansServer = require('sans-server');
const Middleware = SansServer.Middleware;

const middleware = new Middleware();

middleware.add(function(req, res, next) {
    // do something ...
    next();
});

const server = new SansServer();
server.use(function(req, res, next) {
    middleware.reverse(req, res, next);
});
```

## Middleware#run

Run through the added hooks in order.

**Signature** **<code>Middleware#run( req, res [, next ]) : Promise|undefined</code>**

**Parameters** 

| Parameter | Description | Type | Default |
| --- | --- | --- | --- |
| req | The [sans-server](#) request object | `Request` | |
| res | The [sans-server](#) response object | `Request` | |
| next | A function to call once all hooks have been run. It will receive an Error as a parameter if there was an unresolved error while running the middleware. If this function is omitted then a promise will be returned  | `function` | `undefined` |

**Returns** a Promise if the `next` parameter was not provided. The promise resolves if there are no unresolved errors while running the middleware, otherwise it rejects with the error reason. If the `next` parameter was provided then `undefined` is returned instead.

**Example**

```js
const SansServer = require('sans-server');
const Middleware = SansServer.Middleware;

const middleware = new Middleware();

middleware.add(function(req, res, next) {
    // do something ...
    next();
});

const server = new SansServer();
server.use(function(req, res, next) {
    middleware.reverse(req, res, next);
});
```