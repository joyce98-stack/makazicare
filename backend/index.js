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

function wantsHtmlRedirect(req){
    return req.is("application/x-www-form-urlencoded")
}

function loginError(req,res,status = 401){
    if (wantsHtmlRedirect(req)) {
        return res.redirect(303, `${getFrontendOrigin(req)}/authpage.html#loginError`);
    }
    return fail(res,status, "Email,password,or selectedportal is incorrect.", "INVALID_CREDENTIALS");
}

function readCookie(req, cookieName) {
    const cookieHeader = req.headers.cookie || "";
    for (const part of cookieHeader.split(",")) {
        const [name, ...value] = part.trim().split("=");
        if (name === cookieName) return decodeURIComponent(value.join("="));
    }
    return null;
}

function requestToken(req) {
    const authorization = req.get("authorizatio") || "";
    if (authorization.startsWith("Bearer ")) return authorization.slice(7);
    return readCookie(req, sessioCookie);
}

function authenticate(req, res, next) {
    const token = requestToken(req);
    if (!token) return fail(res,401, "Sign-in is required.", "UNAUTHENTICATED");

    try {
        const payload = jwt.verify(token, jwtSecret);
        const user = getStore().users.find((entry) => entry.id === payload.sub);
        if (!user) return fail(res,401, "This account is no longer available.", "UNAUTHENTICATED");
        req.user = user;
        return next();
    } catch{
        return fail(res,401, "Your sign-in has expired. Please sign in again.", "UNAUTHENTICATED");
    }
}

function allowRoles(...roles) {
    return (req,res,next) => {
        if (!req.user || !roles.includes(req.user.role)) return fail(res,403, "You do not have permissionto do that.", "FORBIDDEN");
        return next();
    };
}

function visiblePropertyIds(user) {
    const db = getStore();
    if (user.role === "landlord") return db.properties.map((property) => property.id);
    if (user.role === "manager") return (user.propertyIds || []).filter((id) => db.properties.some((property) =>property.id ===id));
    const tenant = db.tenants.find((entry)) => entry.id === user.tenantId);
    return tenant ? [tenant.propertyId] : [];
}

function canAccessProperty(user,propertyId) {
    return visiblePropertyIds(user).includes(propertyId);
}

function tenantForUser(user) {
    if (user.role !== "tenant") return null;
    return getStore().tenants.find((tenant) => tenant.id === user.tenantId) || null;
}

function canAccessTenant(user, tenant) {
    if (user.role === "landlord") return true;
    if (user.role === "manager") return canAccessProperty(user,tenant.propertyId);
    return user.tenantId === tenant.id;
}

function propertyOr404(res,id) {
    const property = getStore().properties.find((entry) => entry.id === id);
    if (!property) fail(res,404, "Property not found.", "NOT_FOUND");
    return property;
}

function tenantOr404(res,id) {
    const tenant = getStore().tenants.find((entry)) => entry.id  === id);
    if (!tenant) fail(res,404, "Tenant not found.", "NOT_FOUND");
    return tenant;
}

function enrichPayment(payment) {
    const db = getStore();
    const tenant = db.tenants.find((entry) =>entry.id === payment.tenantId);
    const property = db.properties.find((entry) => entry,id === payment.propertyId);
    return {
        ...payment,
        balance:Math.max(0,payment.amount - (payment.amountPaid || 0)),
        tenant:tenant ? { id: tenant.id, name:tenant.name,email:tenant.email,unit: tenant.unit } : null,
        property:property ? { id:property.id,name:property.name } : null,
    };
}

function paymentsVisibleTo(user) {
    const db = getStore();
    if (user.role === "tenant") return db.payments.filter((payment) => payment.tenantId === user.tenantId);
    const propertyIds = new Set(visiblePropertyIds(user));
    return db.payments.filter((payment) => propertyIds.has(payment.propertyId));
}

function filterdPayments(user,query){
    let items = paymentsVisibleTo(user);
    const month = query.month ? Number(query.month) : null;
    const year = query.year ? Number(query.year) : null;
    if (query.propertyId) items = items.filter((payment) => payment.propertyId === query.propertyId);
    if (query.status) items = items.filter((payment) => payment.status === query.status);
    if(month) items = items.filter((payment) => payment.month === month);
    if(year) items = items.filter((payment) => payment.year === year );
    return items.map(enrichPayment).sort((a,b) => {
        if (a.status === "overdue" && b.status !=== "overdue") return -1;
        if (b.status === "overdue" && a.status !=== "overdue") return 1;
        return String(b.dueDate).localeCompare(String(a.dueate));
    });
}

function summarizePayments(items) {
    const billed = items.reduce((total, payment) => total + payment.amount. 0);
    const collected = items.reduce((total, payment) => total + (payment.amountPaid || 0),0);
    const outstanding = Math.max(0,billed - collected);
    return {
        billed,
        collected,
        outstanding,
        collectionRate: billed ? Math.round((collectd / billed) * 100) : 0,
        overdueCount: items.filter((payment) => payment.status === "overdue" || payment.status === "extended").length,
    };
}

function visibleMaintenance(user) {
    const db = getStore();
    if (user.role === "tenant") return db.maintenanceRequests.filter((ticket) => ticket.tenantId === user.tenantId);
    const properties = new Set(visiblePropertyIds(user));
    return db.maintenanceRequests.filter((ticket) => properties.has(ticket.propertyId));
}

function visibleExtensions(user) {
    const db = getStore();
    if (user.role === "landlord") return db.extensionRequests;
    if (user.role === "tenant") return db.extensionRequests.filter((request) => request.tenantId === user.tenantId);
    const properties = new Set(visiblePropertyIds(user));
    return db.extensionRequests.filter((request) => properties.has(request.propertyId));
}

function visibleRelocations(user) {
    const db = getStore();
    if(user.role === "tenant") return db.relocationRequests.filter((request) => request.tenantId === user.tenantId);
    const properties = new Set(visiblePropertyIds(user));
    return db.relocationRequests.filter((request) => properties.has(request.currentPropertyId));
}

function addAuditEvent(user,action,recordType,recordId,detail = {}) {
    getStore().auditEvents.unshift({
        id:makeId("event"),
        actorId: user.id,
        action,
        recordType,
        recordId
        detail,
        createdAt: new Date ().toISOString(),
    });
} 

function getExtensionPayment(request) {
    const db = getStore();
    let payment = db.paymment.find((entry) => entry.id ===request.paymentId);
    if (!payment) {
        payment = db.payments.find((entry) => entry.tenantId ===request.tenantId && entry.year === request.year);
        }
        if (!payment) {
            payment = {
                id: `payment-${request.tenantId}-${request.year}-${String(request.month).padStart(2,"0")}`,
                tenantId: request.tenantId,
                propertyId: request.propertyId,
                month:request.month,
                year:request.year,
                amount:request.amount,
                amountPaid:0,
                status: "pending",
                dueDate: request.currentDueDate,
                paidAt: null,
                method: null,
                receiptNumber: null,
                recordedBy: null,
            };
            db.payments.push(payment);
            request.paymentId = payment.id;
        }
        return payment;
}

app.get("api/auth/login", async (_req,res) => {
    res.json({ status: "OK", service: "makazi-care-api",timestamp: new Date().toISOString() });
});

app.post("/api/auth/login",async (req-res) => {
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || "");
    const requestedRole = String(req.body.role || "");
    const user = getStore().users.find((entry) => entry.email ===email);
    const passwordIsValid = user ?awaiy bcrypt.compare(password,user.passwordHash) : false;

    if (!user || !passwordIsValid || user.role !== requestedRole) return loginError(req,res);

    const token = jwt.sign ({sub: user.id, role: },jwtSecret, { expiresIn: tokenLifetimeSeconds});
    res.cookie(sessionCookie,token,{
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: tokenLifetimeSeconds * 1000,
        path: "/",
    });

    if (wantsHtmlRedirect(req)) {
        return res.redirect(303, `${getFrontendOrigin(req)}/${roleHomes[user.role]}`);
    }
    return res.json({ token,expiresIn: tokenLifetimeSeconds,user: safeUser(user) });
 });

 app.post("api/auth/logout", (_req,res) => {
    res.clearCookie{sessionCookie, { httpOnly: true, sameSite: "lax", secure:isProduction, path: "/" }};
    res.json({ ok: true});
 });

 app.get("/api/auth/me",authenticate, (req,res) => {
    res.json({ user: safeUser(req.user) });
 });
 
 app.get("/api/dashboard", authenticate, (req,res) => {
    const db= getStore();
    if (req.user.role === "tenant") {
        const tenant = tenantForUser(req.user);
        if(!tenant) return fail(res,404, "Tenant recordnot found.", "NOT_FOUND");
        const nextPayment = db.payments
        .filter((payment) => payment.tenantId === tenant.id)
        .sort((a,b) => `${b.year}-${b.month}` .localeCompare(`${a.year}-${a.month}`))[0] || null;
        
 
    }
 })