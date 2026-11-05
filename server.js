const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const express = require("express");
const rateLimit = require("express-rate-limit").rateLimit;
const jwt = require("jsonwebtoken");
const pool = require("./src/script/db");

const app = express();
const port = Number(process.env.PORT || 3000);
const cookieName = "gafont_session";
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be set to a secret of at least 32 characters.");
}

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get(["/", "/index.html"], async (request, response, next) => {
    const token = request.cookies[cookieName];

    if (!token) {
        return response.redirect("/login.html");
    }

    try {
        const payload = jwt.verify(token, jwtSecret);
        const [users] = await pool.execute(
            "SELECT id FROM users WHERE id = ? LIMIT 1",
            [payload.sub],
        );

        if (!users[0]) {
            clearSessionCookie(response);
            return response.redirect("/login.html");
        }

        return next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
            clearSessionCookie(response);
            return response.redirect("/login.html");
        }

        return next(error);
    }
});

app.use(express.static(path.join(__dirname, "..")));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
});

function setSessionCookie(response, userId) {
    const token = jwt.sign({ sub: String(userId) }, jwtSecret, { expiresIn: "7d" });
    response.cookie(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: sessionDurationMs,
        path: "/",
    });
}

function clearSessionCookie(response) {
    response.clearCookie(cookieName, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
    });
}

function parseUserInput(body = {}) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    return { name, email, password };
}

function isValidEmail(email) {
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.post("/api/register", authLimiter, async (request, response) => {
    const { name, email, password } = parseUserInput(request.body);

    if (!name || name.length > 100 || !isValidEmail(email)
        || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
        return response.status(400).json({
            error: "Nama, email yang valid, dan password 8-72 byte wajib diisi.",
        });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
        const [result] = await pool.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            [name, email, passwordHash],
        );

        setSessionCookie(response, result.insertId);
        return response.status(201).json({
            user: { id: result.insertId, name, email },
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return response.status(409).json({ error: "Email sudah terdaftar." });
        }

        throw error;
    }
});

app.post("/api/login", authLimiter, async (request, response) => {
    const { email, password } = parseUserInput(request.body);

    if (!isValidEmail(email) || !password || Buffer.byteLength(password, "utf8") > 72) {
        return response.status(400).json({ error: "Email atau password tidak valid." });
    }

    const [users] = await pool.execute(
        "SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1",
        [email],
    );
    const user = users[0];
    const passwordMatches = user
        ? await bcrypt.compare(password, user.password_hash)
        : false;

    if (!passwordMatches) {
        return response.status(401).json({ error: "Email atau password salah." });
    }

    setSessionCookie(response, user.id);
    return response.json({
        user: { id: user.id, name: user.name, email: user.email },
    });
});

app.post("/api/logout", (request, response) => {
    clearSessionCookie(response);
    return response.status(204).end();
});

app.get("/api/me", async (request, response) => {
    const token = request.cookies?.[cookieName];

    if (!token) {
        return response.status(401).json({ error: "Belum login." });
    }

    try {
        const payload = jwt.verify(token, jwtSecret);
        const [users] = await pool.execute(
            "SELECT id, name, email FROM users WHERE id = ? LIMIT 1",
            [payload.sub],
        );

        if (!users[0]) {
            clearSessionCookie(response);
            return response.status(401).json({ error: "Sesi tidak valid." });
        }

        return response.json({ user: users[0] });
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
            clearSessionCookie(response);
            return response.status(401).json({ error: "Sesi tidak valid atau sudah berakhir." });
        }

        throw error;
    }
});

app.use((error, request, response, next) => {
    console.error("API error:", error);

    if (response.headersSent) {
        return next(error);
    }

    if (error.type === "entity.parse.failed") {
        return response.status(400).json({ error: "Format JSON tidak valid." });
    }

    if (error.type === "entity.too.large") {
        return response.status(413).json({ error: "Ukuran request terlalu besar." });
    }

    return response.status(500).json({ error: "Terjadi kesalahan pada server." });
});

app.listen(port, () => {
    console.log(`GaFont auth API listening on http://localhost:${port}`);
});
