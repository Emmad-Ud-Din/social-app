// Login rate limiting: slows down password guessing.
//
// After MAX_FAILURES wrong passwords for the same email from the same IP
// address within WINDOW_MS, further login attempts for that email from that
// IP get 429 Too Many Requests until the window has passed.
// A successful login clears the count.
//
// The counts live in memory (a Map), so they reset when the server restarts
// and are not shared between several servers. That is fine for one server;
// bigger apps keep these counts in a shared store such as Redis.

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;   // 15 minutes

// key "ip|email" -> { count, firstFailureAt }
const failures = new Map();

function keyFor(req) {
    const email = String(req.body.email || '').toLowerCase();
    return `${req.ip}|${email}`;
}

// Middleware: runs before the login route.
function checkLoginLimit(req, res, next) {
    const entry = failures.get(keyFor(req));
    if (entry) {
        const age = Date.now() - entry.firstFailureAt;
        if (age > WINDOW_MS) {
            failures.delete(keyFor(req));          // old failures no longer count
        } else if (entry.count >= MAX_FAILURES) {
            const secondsLeft = Math.ceil((WINDOW_MS - age) / 1000);
            res.set('Retry-After', String(secondsLeft));
            return res.status(429).json({ error: 'too many failed login attempts, try again later' });
        }
    }
    next();
}

function recordFailure(req) {
    const key = keyFor(req);
    const entry = failures.get(key);
    if (entry) {
        entry.count += 1;
    } else {
        failures.set(key, { count: 1, firstFailureAt: Date.now() });
    }
}

function clearFailures(req) {
    failures.delete(keyFor(req));
}

module.exports = { checkLoginLimit, recordFailure, clearFailures, MAX_FAILURES };
