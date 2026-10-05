const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the production script and registered mouse handlers. No Bluetooth
// device, browser, network, or third-party package is needed for these tests.
const sourcePath = process.env.CONTROLLER_HTML || path.join(__dirname, '..', 'index.html');
const source = fs.readFileSync(sourcePath, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

function controller({ deferred = false } = {}) {
    const nodes = new Map();
    const writes = [], pending = [], logs = [];
    const timers = new Map();
    let nextTimerId = 0;
    let now = 0;
    function node(id) {
        if (!nodes.has(id)) nodes.set(id, {
            id, style: {}, textContent: '', handlers: {},
            addEventListener(event, callback) { this.handlers[event] = callback; }
        });
        return nodes.get(id);
    }
    const characteristic = {
        writeValue(packet) {
            writes.push(Array.from(packet));
            return deferred
                ? new Promise((resolve, reject) => pending.push({ resolve, reject }))
                : Promise.resolve();
        }
    };
    const context = vm.createContext({
        console: { log(message) { logs.push(message); } }, Uint8Array, characteristic,
        document: {
            getElementById: node,
            querySelectorAll() { return ['up', 'down', 'left', 'right'].map(node); }
        }, navigator: {},
        setTimeout(callback, delay) {
            const id = ++nextTimerId;
            timers.set(id, { callback, at: now + delay });
            return id;
        },
        clearTimeout(id) { timers.delete(id); }
    });
    vm.runInContext(source + '\ngimbalglobalCharacteristic = characteristic; setupControlButtons();', context);
    const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
    return {
        writes, pending, timers, logs, context, flush,
        press(id) { node(id).handlers.mousedown(); },
        release(id) { node(id).handlers.mouseup(); },
        leave(id) { node(id).handlers.mouseleave(); },
        async advance(ms) {
            now += ms;
            for (const [id, timer] of Array.from(timers)) {
                if (timer.at <= now && timers.delete(id)) timer.callback();
            }
            await flush();
        }
    };
}

test('one hold sends immediately and repeats every 200 ms', async () => {
    const c = controller();
    c.press('up'); await c.flush();
    assert.equal(c.writes.length, 1);
    await c.advance(199); assert.equal(c.writes.length, 1);
    await c.advance(1); assert.equal(c.writes.length, 2);
    assert.deepEqual(c.writes[1], c.writes[0]);
});

test('release cancels repeat and permits another press', async () => {
    const c = controller(); c.press('up'); await c.flush();
    c.release('up'); await c.advance(200);
    assert.equal(c.writes.length, 1);
    c.press('right'); await c.flush();
    assert.equal(c.writes.length, 2);
    assert.notDeepEqual(c.writes[0], c.writes[1]);
});

test('changing direction before the old timeout cannot revive old packets', async () => {
    const c = controller(); c.press('up'); await c.flush();
    c.release('up'); c.press('right'); await c.flush();
    const right = c.writes[1];
    for (let i = 0; i < 5; i++) await c.advance(200);
    assert.equal(c.writes.length, 7);
    for (const packet of c.writes.slice(1)) assert.deepEqual(packet, right);
    assert.equal(c.timers.size, 1);
});

test('repeated same-direction presses cannot multiply repeat loops', async () => {
    const c = controller();
    for (let i = 0; i < 5; i++) { c.press('up'); await c.flush(); c.release('up'); }
    c.press('up'); await c.flush();
    await c.advance(200);
    assert.equal(c.writes.length, 7);
    assert.equal(c.timers.size, 1);
});

test('duplicate mousedown while held is ignored', async () => {
    const c = controller(); c.press('up'); c.press('right'); await c.flush();
    assert.equal(c.writes.length, 1);
    await c.advance(200); assert.equal(c.writes.length, 2);
    assert.deepEqual(c.writes[0], c.writes[1]);
});

test('mouseleave also invalidates the previous hold', async () => {
    const c = controller(); c.press('left'); await c.flush();
    c.leave('left'); c.press('down'); await c.flush();
    await c.advance(200);
    assert.equal(c.writes.length, 3);
    assert.deepEqual(c.writes[1], c.writes[2]);
});

test('stale successful write cannot schedule a repeat after switching', async () => {
    const c = controller({ deferred: true });
    c.press('up'); c.release('up'); c.press('right');
    c.pending[1].resolve(); await c.flush();
    c.pending[0].resolve(); await c.flush();
    assert.equal(c.timers.size, 1);
    await c.advance(200);
    assert.equal(c.writes.length, 3);
    assert.deepEqual(c.writes[1], c.writes[2]);
});

test('stale failed write cannot cancel the current direction', async () => {
    const c = controller({ deferred: true });
    c.press('up'); c.release('up'); c.press('right');
    c.pending[0].reject(new Error('old write failed')); await c.flush();
    c.pending[1].resolve(); await c.flush(); await c.advance(200);
    assert.equal(c.writes.length, 3);
    assert.deepEqual(c.writes[1], c.writes[2]);
});

test('releasing during an in-flight write cannot leave a live timer', async () => {
    const c = controller({ deferred: true });
    c.press('up'); c.release('up'); c.pending[0].resolve(); await c.flush();
    assert.equal(c.timers.size, 0);
    await c.advance(200); assert.equal(c.writes.length, 1);
});

test('a failure belonging to the current hold stops it and permits retry', async () => {
    const c = controller({ deferred: true }); c.press('up');
    c.pending[0].reject(new Error('current write failed')); await c.flush();
    await c.advance(200); assert.equal(c.writes.length, 1);
    c.press('right'); assert.equal(c.writes.length, 2);
});
