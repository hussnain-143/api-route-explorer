import * as assert from 'assert';
import { parseExpressRoutes, LineIndex, maskComments } from '../scanner/routeParser';

suite('API Routes Explorer — Express Route Parser Suite', () => {
  test('LineIndex accurately converts offsets to 0-based line and column', () => {
    const source = 'line0\n    line1\r\nline2';
    const index = new LineIndex(source);

    // Start of line 0
    assert.deepStrictEqual(index.getPosition(0), { line: 0, column: 0 });

    // "line1" starts after "line0\n" (6 chars) + 4 spaces = offset 10
    assert.deepStrictEqual(index.getPosition(6), { line: 1, column: 0 });
    assert.deepStrictEqual(index.getPosition(10), { line: 1, column: 4 });

    // line 2 starts after "line0\n    line1\r\n" (6 + 9 + 2 = 17)
    assert.deepStrictEqual(index.getPosition(17), { line: 2, column: 0 });
  });

  test('maskComments strips single-line and multi-line comments while preserving offsets', () => {
    const source = '// app.get("/commented", h);\n/* multi\nline */\napp.get("/active", h);';
    const masked = maskComments(source);

    assert.ok(!masked.includes('commented'));
    assert.ok(masked.includes('app.get("/active", h);'));
    assert.strictEqual(masked.length, source.length, 'Masked source must maintain identical length');
  });

  test('Detects app HTTP methods with double and single quotes', () => {
    const source = `
const app = express();
app.get("/health", healthHandler);
app.post('/users', createUser);
app.put("/users/:id", updateUser);
app.patch('/users/:id', patchUser);
app.delete("/users/:id", deleteUser);
`;
    const routes = parseExpressRoutes(source, '/test/app.js');

    assert.strictEqual(routes.length, 5);
    assert.deepStrictEqual(routes[0], {
      method: 'GET',
      path: '/health',
      filePath: '/test/app.js',
      line: 2,
      column: 0,
      framework: 'express',
    });
    assert.deepStrictEqual(routes[1], {
      method: 'POST',
      path: '/users',
      filePath: '/test/app.js',
      line: 3,
      column: 0,
      framework: 'express',
    });
    assert.deepStrictEqual(routes[2], {
      method: 'PUT',
      path: '/users/:id',
      filePath: '/test/app.js',
      line: 4,
      column: 0,
      framework: 'express',
    });
    assert.deepStrictEqual(routes[3], {
      method: 'PATCH',
      path: '/users/:id',
      filePath: '/test/app.js',
      line: 5,
      column: 0,
      framework: 'express',
    });
    assert.deepStrictEqual(routes[4], {
      method: 'DELETE',
      path: '/users/:id',
      filePath: '/test/app.js',
      line: 6,
      column: 0,
      framework: 'express',
    });
  });

  test('Detects router HTTP methods with template literals without interpolation', () => {
    const source = `
const router = express.Router();
router.get(\`/users\`, getUsers);
router.post(\`/users\`, createUser);
router.put(\`/users/:id\`, updateUser);
router.patch(\`/users/:id\`, patchUser);
router.delete(\`/users/:id\`, deleteUser);
`;
    const routes = parseExpressRoutes(source, '/test/routes/users.js');

    assert.strictEqual(routes.length, 5);
    assert.strictEqual(routes[0].method, 'GET');
    assert.strictEqual(routes[0].path, '/users');
    assert.strictEqual(routes[0].line, 2);
    assert.strictEqual(routes[0].column, 0);

    assert.strictEqual(routes[4].method, 'DELETE');
    assert.strictEqual(routes[4].path, '/users/:id');
    assert.strictEqual(routes[4].line, 6);
  });

  test('Correctly ignores template literals with dynamic interpolation', () => {
    const source = `
app.get(\`\${prefix}/users\`, handler);
router.post(\`/api/\${version}/auth\`, authHandler);
app.get("/static/valid", validHandler);
`;
    const routes = parseExpressRoutes(source, '/test/dynamic.js');

    assert.strictEqual(routes.length, 1);
    assert.strictEqual(routes[0].method, 'GET');
    assert.strictEqual(routes[0].path, '/static/valid');
  });

  test('Ignores commented-out route declarations', () => {
    const source = `
// app.get('/old-endpoint', handler);
/*
router.post('/deprecated', handler);
*/
app.get('/live', liveHandler);
`;
    const routes = parseExpressRoutes(source, '/test/comments.js');

    assert.strictEqual(routes.length, 1);
    assert.strictEqual(routes[0].path, '/live');
    assert.strictEqual(routes[0].line, 5);
  });

  test('Supports TypeScript generic type parameters in route calls', () => {
    const source = `
app.get<ReqParams>('/typed-users', handler);
router.post<BodyType>('/typed-create', handler);
`;
    const routes = parseExpressRoutes(source, '/test/typed.ts');

    assert.strictEqual(routes.length, 2);
    assert.strictEqual(routes[0].method, 'GET');
    assert.strictEqual(routes[0].path, '/typed-users');
    assert.strictEqual(routes[1].method, 'POST');
    assert.strictEqual(routes[1].path, '/typed-create');
  });

  test('Safely handles empty string and malformed/invalid source code without crashing', () => {
    assert.deepStrictEqual(parseExpressRoutes('', '/test/empty.js'), []);
    assert.deepStrictEqual(parseExpressRoutes('const x = ;;; {{', '/test/invalid.js'), []);
    assert.deepStrictEqual(parseExpressRoutes('no routes here', '/test/none.js'), []);
  });

  test('Accurately detects all routes in sample Express application and router files', () => {
    const appJs = `const express = require("express");

const app = express();

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.post("/users", createUser);

app.listen(3000);
`;

    const appRoutes = parseExpressRoutes(appJs, '/workspace/sample/app.js');
    assert.strictEqual(appRoutes.length, 2);
    assert.deepStrictEqual(appRoutes[0], {
      method: 'GET',
      path: '/health',
      filePath: '/workspace/sample/app.js',
      line: 4,
      column: 0,
      framework: 'express',
    });
    assert.deepStrictEqual(appRoutes[1], {
      method: 'POST',
      path: '/users',
      filePath: '/workspace/sample/app.js',
      line: 8,
      column: 0,
      framework: 'express',
    });

    const userRoutesJs = `const express = require("express");

const router = express.Router();

router.get("/users", getUsers);
router.get("/users/:id", getUser);
router.put("/users/:id", updateUser);
router.patch("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

module.exports = router;
`;

    const userRoutes = parseExpressRoutes(userRoutesJs, '/workspace/sample/routes/userRoutes.js');
    assert.strictEqual(userRoutes.length, 5);
    assert.strictEqual(userRoutes[0].method, 'GET');
    assert.strictEqual(userRoutes[0].path, '/users');
    assert.strictEqual(userRoutes[0].line, 4);

    assert.strictEqual(userRoutes[1].method, 'GET');
    assert.strictEqual(userRoutes[1].path, '/users/:id');
    assert.strictEqual(userRoutes[1].line, 5);

    assert.strictEqual(userRoutes[2].method, 'PUT');
    assert.strictEqual(userRoutes[2].path, '/users/:id');
    assert.strictEqual(userRoutes[2].line, 6);

    assert.strictEqual(userRoutes[3].method, 'PATCH');
    assert.strictEqual(userRoutes[3].path, '/users/:id');
    assert.strictEqual(userRoutes[3].line, 7);

    assert.strictEqual(userRoutes[4].method, 'DELETE');
    assert.strictEqual(userRoutes[4].path, '/users/:id');
    assert.strictEqual(userRoutes[4].line, 8);
  });
});
