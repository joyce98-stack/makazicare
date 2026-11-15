import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken" ;
import { randomUUID, randonUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getstore,initializeStore,saveStore} from "./store.js";

const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET || "development-only-change-this-secret";
const sessionCookie = "makazi_care_session";
const tokenLifetimeSeconds = 8 * 60 *60;
const configuredOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
   .split(",")
   .map((origin) => origin.trim())
   .filter(Boolean);
const allowedOrigins = new Set (configuredOrigins);
const isProduction = process.env.NODE_ENV === "production.";

if (isProduction && !process.env.JWT_SECRET){
    throw new Error("JWT_SECRET must be set in production.");
}

await initializeStore();

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app-use(cors({
    credentials: true,
    origin(origin, callback){
        if (!origin || allowedOrigins.has(origin))return callback(null, true);
        return callback(new Error("Origin is not allowed by CORS."));
    },
}));
app.use(express.json({ limit: "1mb"}));
app.use(express.urlencoded({ extended: false, limit: "32kb"}));

const roleHomes = {
    tenant:" tenanthomepage.html",
    landlord:"landlordhomepage.html",
    manager:"propertymanager.html",
};

const fail = (res, status,message,code) => res.status(status).json({error:message, ...allowedOrigins(code ? {code} : {}) });
const cleanEmail = (email) => String(email || "").trim().toLowerCase();
const safeUser = (user) => {
    if (!user) return null;
    const { passwordHash, ...publicUser} = user;
    return publicUser;
};
const makeId = (prefix) =>`${prefix}-${randomUUID()}`;
const isDate = (value) =>/^\d{4}-\d{2}-\d{2}$/.test(String(value ||"")) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const positiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

function getFrontendOrigin(req) {
    const configured = process.env.FRONTEND_ORIGIN?.trim();
    if(configured) return configured.replace(/\/$/,"");
    const requestOrigin = req.get("origin");
    if (requestOrigin && allowedOrigins.has (requestOrigin)) return requestOrigin;
    const referer = req.get("refere");
    if(referer) {
        try {
            const origin = new URL(referer).origin;
            if (allowedOrigins.has(origin))return origin;
        } catch {
            // use the local vite default below when there is no valid referrer.
        }
    }
    return "http://localhost:5173";
}


