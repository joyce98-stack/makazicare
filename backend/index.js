import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStore, initializeStore, saveStore } from "./store.js";

const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET || "development-only-change-this-secret";
const sessionCookie = "makazi_care_session";
const tokenLifetimeSeconds = 8 * 60 * 60;
const configuredOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production.");
}

await initializeStore();

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));

const roleHomes = {
  tenant: "tenanthomepage.html",
  landlord: "landlordhomepage.html",
  manager: "managerhomepage.html",
};

const fail = (res, status, message, code) => res.status(status).json({ error: message, ...(code ? { code } : {}) });
const cleanEmail = (email) => String(email || "").trim().toLowerCase();
const safeUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...publicUser } = user;
  return publicUser;
};
const makeId = (prefix) => `${prefix}-${randomUUID()}`;
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const positiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

function getFrontendOrigin(req) {
  const configured = process.env.FRONTEND_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const requestOrigin = req.get("origin");
  if (requestOrigin && allowedOrigins.has(requestOrigin)) return requestOrigin;
  const referer = req.get("referer");
  if (referer) {
    try {
      const origin = new URL(referer).origin;
      if (allowedOrigins.has(origin)) return origin;
    } catch {
      // Use the local Vite default below when there is no valid referrer.
    }
  }
  return "http://localhost:5173";
}

function wantsHtmlRedirect(req) {
  return req.is("application/x-www-form-urlencoded") || req.is("multipart/form-data");
}

function loginError(req, res, status = 401) {
  if (wantsHtmlRedirect(req)) {
    return res.redirect(303, `${getFrontendOrigin(req)}/authpage.html#loginError`);
  }
  return fail(res, status, "Email, password, or selected portal is incorrect.", "INVALID_CREDENTIALS");
}

function readCookie(req, cookieName) {
  const cookieHeader = req.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === cookieName) return decodeURIComponent(value.join("="));
  }
  return null;
}

function requestToken(req) {
  const authorization = req.get("authorization") || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7);
  return readCookie(req, sessionCookie);
}

function authenticate(req, res, next) {
  const token = requestToken(req);
  if (!token) return fail(res, 401, "Sign-in is required.", "UNAUTHENTICATED");

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = getStore().users.find((entry) => entry.id === payload.sub);
    if (!user) return fail(res, 401, "This account is no longer available.", "UNAUTHENTICATED");
    req.user = user;
    return next();
  } catch {
    return fail(res, 401, "Your sign-in has expired. Please sign in again.", "UNAUTHENTICATED");
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return fail(res, 403, "You do not have permission to do that.", "FORBIDDEN");
    return next();
  };
}

function visiblePropertyIds(user) {
  const db = getStore();
  if (user.role === "landlord") return db.properties.map((property) => property.id);
  if (user.role === "manager") return (user.propertyIds || []).filter((id) => db.properties.some((property) => property.id === id));
  const tenant = db.tenants.find((entry) => entry.id === user.tenantId);
  return tenant ? [tenant.propertyId] : [];
}

function canAccessProperty(user, propertyId) {
  return visiblePropertyIds(user).includes(propertyId);
}

function tenantForUser(user) {
  if (user.role !== "tenant") return null;
  return getStore().tenants.find((tenant) => tenant.id === user.tenantId) || null;
}

function canAccessTenant(user, tenant) {
  if (user.role === "landlord") return true;
  if (user.role === "manager") return canAccessProperty(user, tenant.propertyId);
  return user.tenantId === tenant.id;
}

function propertyOr404(res, id) {
  const property = getStore().properties.find((entry) => entry.id === id);
  if (!property) fail(res, 404, "Property not found.", "NOT_FOUND");
  return property;
}

function tenantOr404(res, id) {
  const tenant = getStore().tenants.find((entry) => entry.id === id);
  if (!tenant) fail(res, 404, "Tenant not found.", "NOT_FOUND");
  return tenant;
}

function enrichPayment(payment) {
  const db = getStore();
  const tenant = db.tenants.find((entry) => entry.id === payment.tenantId);
  const property = db.properties.find((entry) => entry.id === payment.propertyId);
  return {
    ...payment,
    balance: Math.max(0, payment.amount - (payment.amountPaid || 0)),
    tenant: tenant ? { id: tenant.id, name: tenant.name, email: tenant.email, unit: tenant.unit } : null,
    property: property ? { id: property.id, name: property.name } : null,
  };
}

function paymentsVisibleTo(user) {
  const db = getStore();
  if (user.role === "tenant") return db.payments.filter((payment) => payment.tenantId === user.tenantId);
  const propertyIds = new Set(visiblePropertyIds(user));
  return db.payments.filter((payment) => propertyIds.has(payment.propertyId));
}

function filteredPayments(user, query) {
  let items = paymentsVisibleTo(user);
  const month = query.month ? Number(query.month) : null;
  const year = query.year ? Number(query.year) : null;
  if (query.propertyId) items = items.filter((payment) => payment.propertyId === query.propertyId);
  if (query.status) items = items.filter((payment) => payment.status === query.status);
  if (month) items = items.filter((payment) => payment.month === month);
  if (year) items = items.filter((payment) => payment.year === year);
  return items.map(enrichPayment).sort((a, b) => {
    if (a.status === "overdue" && b.status !== "overdue") return -1;
    if (b.status === "overdue" && a.status !== "overdue") return 1;
    return String(b.dueDate).localeCompare(String(a.dueDate));
  });
}

function summarizePayments(items) {
  const billed = items.reduce((total, payment) => total + payment.amount, 0);
  const collected = items.reduce((total, payment) => total + (payment.amountPaid || 0), 0);
  const outstanding = Math.max(0, billed - collected);
  return {
    billed,
    collected,
    outstanding,
    collectionRate: billed ? Math.round((collected / billed) * 100) : 0,
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
  if (user.role === "tenant") return db.relocationRequests.filter((request) => request.tenantId === user.tenantId);
  const properties = new Set(visiblePropertyIds(user));
  return db.relocationRequests.filter((request) => properties.has(request.currentPropertyId));
}

function addAuditEvent(user, action, recordType, recordId, detail = {}) {
  getStore().auditEvents.unshift({
    id: makeId("event"),
    actorId: user.id,
    action,
    recordType,
    recordId,
    detail,
    createdAt: new Date().toISOString(),
  });
}

function getExtensionPayment(request) {
  const db = getStore();
  let payment = db.payments.find((entry) => entry.id === request.paymentId);
  if (!payment) {
    payment = db.payments.find((entry) => entry.tenantId === request.tenantId && entry.month === request.month && entry.year === request.year);
  }
  if (!payment) {
    payment = {
      id: `payment-${request.tenantId}-${request.year}-${String(request.month).padStart(2, "0")}`,
      tenantId: request.tenantId,
      propertyId: request.propertyId,
      month: request.month,
      year: request.year,
      amount: request.amount,
      amountPaid: 0,
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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "makazi-care-api", timestamp: new Date().toISOString() });
});

app.post("/api/auth/login", async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || "");
  const requestedRole = String(req.body.role || "");
  const user = getStore().users.find((entry) => entry.email === email);
  const passwordIsValid = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !passwordIsValid || user.role !== requestedRole) return loginError(req, res);

  const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: tokenLifetimeSeconds });
  res.cookie(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: tokenLifetimeSeconds * 1000,
    path: "/",
  });

  if (wantsHtmlRedirect(req)) {
    return res.redirect(303, `${getFrontendOrigin(req)}/${roleHomes[user.role]}`);
  }
  return res.json({ token, expiresIn: tokenLifetimeSeconds, user: safeUser(user) });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(sessionCookie, { httpOnly: true, sameSite: "lax", secure: isProduction, path: "/" });
  res.json({ ok: true });
});

app.get("/api/auth/me", authenticate, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

app.get("/api/dashboard", authenticate, (req, res) => {
  const db = getStore();
  if (req.user.role === "tenant") {
    const tenant = tenantForUser(req.user);
    if (!tenant) return fail(res, 404, "Tenant record not found.", "NOT_FOUND");
    const nextPayment = db.payments
      .filter((payment) => payment.tenantId === tenant.id)
      .sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`))[0] || null;
    return res.json({
      user: safeUser(req.user),
      tenant,
      property: db.properties.find((property) => property.id === tenant.propertyId),
      nextPayment: nextPayment ? enrichPayment(nextPayment) : null,
      maintenanceOpen: db.maintenanceRequests.filter((ticket) => ticket.tenantId === tenant.id && ticket.status !== "resolved").length,
    });
  }

  const period = filteredPayments(req.user, { month: req.query.month || "11", year: req.query.year || "2026" });
  return res.json({
    user: safeUser(req.user),
    summary: summarizePayments(period),
    properties: visiblePropertyIds(req.user).map((id) => db.properties.find((property) => property.id === id)),
    tenants: db.tenants.filter((tenant) => canAccessTenant(req.user, tenant)).length,
    maintenanceOpen: visibleMaintenance(req.user).filter((ticket) => ticket.status !== "resolved").length,
  });
});

app.get("/api/properties", authenticate, (req, res) => {
  const db = getStore();
  const propertyIds = new Set(visiblePropertyIds(req.user));
  const properties = db.properties
    .filter((property) => propertyIds.has(property.id))
    .map((property) => ({
      ...property,
      occupiedCount: db.tenants.filter((tenant) => tenant.propertyId === property.id && tenant.status === "active").length,
    }));
  res.json({ items: properties });
});

app.post("/api/properties", authenticate, allowRoles("landlord"), async (req, res) => {
  const { name, address, type, unitCount } = req.body;
  if (!String(name || "").trim() || !String(address || "").trim() || !positiveNumber(unitCount)) {
    return fail(res, 400, "Name, address, and a positive unit count are required.", "VALIDATION_ERROR");
  }
  const property = {
    id: makeId("property"),
    name: String(name).trim(),
    address: String(address).trim(),
    type: String(type || "apartment").trim(),
    unitCount: Number(unitCount),
    ownerId: req.user.id,
    createdAt: new Date().toISOString(),
  };
  getStore().properties.push(property);
  req.user.propertyIds.push(property.id);
  addAuditEvent(req.user, "property.created", "property", property.id);
  await saveStore();
  res.status(201).json({ item: property });
});

app.get("/api/tenants", authenticate, (req, res) => {
  const db = getStore();
  let tenants = db.tenants.filter((tenant) => canAccessTenant(req.user, tenant));
  if (req.query.propertyId) tenants = tenants.filter((tenant) => tenant.propertyId === req.query.propertyId);
  if (req.query.status) tenants = tenants.filter((tenant) => tenant.status === req.query.status);
  if (req.query.search) {
    const search = String(req.query.search).trim().toLowerCase();
    tenants = tenants.filter((tenant) => `${tenant.name} ${tenant.unit} ${tenant.email}`.toLowerCase().includes(search));
  }
  res.json({ items: tenants.map((tenant) => ({
    ...tenant,
    property: db.properties.find((property) => property.id === tenant.propertyId),
  })) });
});

app.post("/api/tenants", authenticate, allowRoles("landlord", "manager"), async (req, res) => {
  const { name, email, phone, propertyId, unit, rent, occupiedSince } = req.body;
  if (!String(name || "").trim() || !/^\S+@\S+\.\S+$/.test(String(email || "")) || !String(unit || "").trim() || !positiveNumber(rent)) {
    return fail(res, 400, "Name, valid email, unit, and positive rent are required.", "VALIDATION_ERROR");
  }
  if (!propertyOr404(res, propertyId)) return;
  if (!canAccessProperty(req.user, propertyId)) return fail(res, 403, "You cannot add tenants to this property.", "FORBIDDEN");
  if (getStore().tenants.some((tenant) => tenant.propertyId === propertyId && tenant.unit.toLowerCase() === String(unit).trim().toLowerCase() && tenant.status === "active")) {
    return fail(res, 409, "That unit already has an active tenant.", "UNIT_OCCUPIED");
  }
  const tenant = {
    id: makeId("tenant"), name: String(name).trim(), email: cleanEmail(email), phone: String(phone || "").trim(),
    propertyId, unit: String(unit).trim(), rent: Number(rent), occupiedSince: isDate(occupiedSince) ? occupiedSince : new Date().toISOString().slice(0, 10), status: "active",
  };
  getStore().tenants.push(tenant);
  addAuditEvent(req.user, "tenant.created", "tenant", tenant.id);
  await saveStore();
  res.status(201).json({ item: tenant });
});

app.get("/api/payments", authenticate, (req, res) => {
  if (req.query.propertyId && !canAccessProperty(req.user, req.query.propertyId)) return fail(res, 403, "You cannot view payments for that property.", "FORBIDDEN");
  const items = filteredPayments(req.user, req.query);
  res.json({ items, summary: summarizePayments(items), count: items.length });
});

app.post("/api/payments", authenticate, allowRoles("landlord", "manager"), async (req, res) => {
  const { tenantId, month, year, dueDate, amount } = req.body;
  const tenant = tenantOr404(res, tenantId);
  if (!tenant) return;
  if (!canAccessTenant(req.user, tenant)) return fail(res, 403, "You cannot record a payment for this tenant.", "FORBIDDEN");
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  const paymentAmount = Number(amount || tenant.rent);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12 || !Number.isInteger(yearNumber) || yearNumber < 2020 || !positiveNumber(paymentAmount) || !isDate(dueDate)) {
    return fail(res, 400, "A valid tenant, month, year, due date, and amount are required.", "VALIDATION_ERROR");
  }
  const duplicate = getStore().payments.find((payment) => payment.tenantId === tenantId && payment.month === monthNumber && payment.year === yearNumber);
  if (duplicate) return fail(res, 409, "A payment record already exists for this tenant and period.", "DUPLICATE_PAYMENT");

  const payment = {
    id: `payment-${tenantId}-${yearNumber}-${String(monthNumber).padStart(2, "0")}`,
    tenantId, propertyId: tenant.propertyId, month: monthNumber, year: yearNumber,
    amount: paymentAmount, amountPaid: 0, status: "pending", dueDate,
    paidAt: null, method: null, receiptNumber: null, recordedBy: null,
  };
  getStore().payments.push(payment);
  addAuditEvent(req.user, "payment.created", "payment", payment.id);
  await saveStore();
  res.status(201).json({ item: enrichPayment(payment) });
});

app.post("/api/payments/:paymentId/record", authenticate, allowRoles("landlord", "manager"), async (req, res) => {
  const payment = getStore().payments.find((entry) => entry.id === req.params.paymentId);
  if (!payment) return fail(res, 404, "Payment record not found.", "NOT_FOUND");
  if (!canAccessProperty(req.user, payment.propertyId)) return fail(res, 403, "You cannot update payments for this property.", "FORBIDDEN");
  const tenant = getStore().tenants.find((entry) => entry.id === payment.tenantId);
  const remaining = Math.max(0, payment.amount - (payment.amountPaid || 0));
  const amount = Number(req.body.amount ?? remaining);
  const method = String(req.body.method || "").trim();
  const paidAt = req.body.paidAt;
  if (!positiveNumber(amount) || amount > remaining || !method || !isDate(paidAt)) {
    return fail(res, 400, "Enter an amount up to the remaining balance, payment method, and valid date.", "VALIDATION_ERROR");
  }
  payment.amountPaid = (payment.amountPaid || 0) + amount;
  payment.method = method;
  payment.paidAt = paidAt;
  payment.status = payment.amountPaid >= payment.amount ? "paid" : "partial";
  payment.recordedBy = req.user.id;
  payment.receiptNumber ||= `RCP-${String(payment.year).slice(-2)}${String(payment.month).padStart(2, "0")}-${tenant.unit.replace(/\W/g, "")}`;
  addAuditEvent(req.user, "payment.recorded", "payment", payment.id, { amount, method });
  await saveStore();
  res.json({ item: enrichPayment(payment) });
});

app.get("/api/receipts", authenticate, (req, res) => {
  const items = filteredPayments(req.user, req.query)
    .filter((payment) => payment.amountPaid > 0)
    .map((payment) => ({
      id: payment.id,
      receiptNumber: payment.receiptNumber,
      tenant: payment.tenant,
      property: payment.property,
      amount: payment.amountPaid,
      method: payment.method,
      paidAt: payment.paidAt,
      month: payment.month,
      year: payment.year,
    }));
  res.json({ items, count: items.length });
});

app.get("/api/reports/payments", authenticate, allowRoles("landlord", "manager"), (req, res) => {
  const month = Number(req.query.month || 11);
  const year = Number(req.query.year || 2026);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) return fail(res, 400, "Month and year are invalid.", "VALIDATION_ERROR");
  if (req.query.propertyId && !canAccessProperty(req.user, req.query.propertyId)) return fail(res, 403, "You cannot view this property report.", "FORBIDDEN");
  const items = filteredPayments(req.user, { ...req.query, month, year });
  const byProperty = visiblePropertyIds(req.user)
    .filter((id) => !req.query.propertyId || id === req.query.propertyId)
    .map((propertyId) => {
      const propertyPayments = items.filter((payment) => payment.propertyId === propertyId);
      return {
        property: getStore().properties.find((property) => property.id === propertyId),
        ...summarizePayments(propertyPayments),
      };
    });
  res.json({ period: { month, year }, summary: summarizePayments(items), byProperty, items, count: items.length });
});

app.get("/api/maintenance", authenticate, (req, res) => {
  let items = visibleMaintenance(req.user);
  if (req.query.propertyId) {
    if (!canAccessProperty(req.user, req.query.propertyId)) return fail(res, 403, "You cannot view requests for this property.", "FORBIDDEN");
    items = items.filter((ticket) => ticket.propertyId === req.query.propertyId);
  }
  if (req.query.status) items = items.filter((ticket) => ticket.status === req.query.status);
  const db = getStore();
  const enriched = items.map((ticket) => ({
    ...ticket,
    tenant: db.tenants.find((tenant) => tenant.id === ticket.tenantId) || null,
    property: db.properties.find((property) => property.id === ticket.propertyId) || null,
  })).sort((a, b) => String(b.reportedAt).localeCompare(String(a.reportedAt)));
  res.json({ items: enriched, count: enriched.length });
});

app.post("/api/maintenance", authenticate, allowRoles("tenant"), async (req, res) => {
  const tenant = tenantForUser(req.user);
  if (!tenant) return fail(res, 404, "Tenant record not found.", "NOT_FOUND");
  const { title, category, description, priority = "normal", preferredDate, accessAllowed = false } = req.body;
  if (!String(title || "").trim() || !String(description || "").trim() || !String(category || "").trim()) {
    return fail(res, 400, "Title, category, and description are required.", "VALIDATION_ERROR");
  }
  if (!isDate(preferredDate) && preferredDate) return fail(res, 400, "Preferred date must use YYYY-MM-DD.", "VALIDATION_ERROR");
  if (!["low", "normal", "urgent"].includes(priority)) return fail(res, 400, "Priority is invalid.", "VALIDATION_ERROR");
  const numericIds = getStore().maintenanceRequests.map((ticket) => Number(String(ticket.id).replace(/\D/g, ""))).filter(Number.isFinite);
  const nextNumber = Math.max(2430, ...numericIds) + 1;
  const ticket = {
    id: `M-${nextNumber}`,
    tenantId: tenant.id,
    propertyId: tenant.propertyId,
    unit: tenant.unit,
    title: String(title).trim(),
    category: String(category).trim(),
    description: String(description).trim(),
    priority,
    preferredDate: preferredDate || null,
    accessAllowed: Boolean(accessAllowed),
    status: "new",
    reportedAt: new Date().toISOString().slice(0, 10),
    visit: null,
  };
  getStore().maintenanceRequests.push(ticket);
  addAuditEvent(req.user, "maintenance.created", "maintenance", ticket.id);
  await saveStore();
  res.status(201).json({ item: ticket });
});

app.patch("/api/maintenance/:ticketId", authenticate, allowRoles("landlord", "manager"), async (req, res) => {
  const ticket = getStore().maintenanceRequests.find((entry) => entry.id === req.params.ticketId);
  if (!ticket) return fail(res, 404, "Maintenance request not found.", "NOT_FOUND");
  if (!canAccessProperty(req.user, ticket.propertyId)) return fail(res, 403, "You cannot update requests for this property.", "FORBIDDEN");
  const { status, assignedTo, visit, resolutionNote } = req.body;
  if (status && !["new", "scheduled", "in_progress", "resolved"].includes(status)) return fail(res, 400, "Status is invalid.", "VALIDATION_ERROR");
  if (visit && (!isDate(visit.date) || !String(visit.window || "").trim())) return fail(res, 400, "Visit date and time window are required.", "VALIDATION_ERROR");
  if (status) ticket.status = status;
  if (assignedTo !== undefined) ticket.assignedTo = String(assignedTo).trim();
  if (visit !== undefined) ticket.visit = visit;
  if (resolutionNote !== undefined) ticket.resolutionNote = String(resolutionNote).trim();
  if (status === "resolved") ticket.resolvedAt = new Date().toISOString().slice(0, 10);
  addAuditEvent(req.user, `maintenance.${status || "updated"}`, "maintenance", ticket.id);
  await saveStore();
  res.json({ item: ticket });
});

app.get("/api/extensions", authenticate, allowRoles("landlord"), (req, res) => {
  let items = visibleExtensions(req.user);
  if (req.query.status) items = items.filter((request) => request.status === req.query.status);
  const db = getStore();
  res.json({ items: items.map((request) => ({
    ...request,
    tenant: db.tenants.find((tenant) => tenant.id === request.tenantId),
    property: db.properties.find((property) => property.id === request.propertyId),
  })), count: items.length });
});

app.post("/api/extensions", authenticate, allowRoles("tenant"), async (req, res) => {
  const tenant = tenantForUser(req.user);
  if (!tenant) return fail(res, 404, "Tenant record not found.", "NOT_FOUND");
  const month = Number(req.body.month);
  const year = Number(req.body.year);
  const requestedPaymentDate = req.body.requestedPaymentDate;
  const currentDueDate = req.body.currentDueDate;
  const paymentPlan = String(req.body.paymentPlan || "full");
  if (!isDate(requestedPaymentDate) || !isDate(currentDueDate) || !["full", "split"].includes(paymentPlan)) {
    return fail(res, 400, "Valid due dates and payment plan are required.", "VALIDATION_ERROR");
  }
  const days = (Date.parse(`${requestedPaymentDate}T00:00:00Z`) - Date.parse(`${currentDueDate}T00:00:00Z`)) / 86400000;
  if (days < 1 || days > 14) return fail(res, 400, "An extension must be between 1 and 14 days.", "INVALID_EXTENSION_DAYS");
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) return fail(res, 400, "Month and year are invalid.", "VALIDATION_ERROR");
  const duplicate = getStore().extensionRequests.find((request) => request.tenantId === tenant.id && request.month === month && request.year === year && request.status === "pending");
  if (duplicate) return fail(res, 409, "You already have a pending request for this month.", "DUPLICATE_REQUEST");

  const request = {
    id: makeId("extension"), tenantId: tenant.id, propertyId: tenant.propertyId,
    month, year, amount: tenant.rent, currentDueDate, requestedPaymentDate, paymentPlan,
    firstPaymentAmount: paymentPlan === "split" ? Number(req.body.firstPaymentAmount || Math.floor(tenant.rent / 2)) : null,
    reason: String(req.body.reason || "other"), note: String(req.body.note || "").trim(),
    status: "pending", submittedAt: new Date().toISOString().slice(0, 10),
  };
  getStore().extensionRequests.push(request);
  addAuditEvent(req.user, "extension.created", "extension", request.id);
  await saveStore();
  res.status(201).json({ item: request });
});

app.patch("/api/extensions/:requestId/decision", authenticate, allowRoles("landlord"), async (req, res) => {
  const request = getStore().extensionRequests.find((entry) => entry.id === req.params.requestId);
  if (!request) return fail(res, 404, "Extension request not found.", "NOT_FOUND");
  if (request.status !== "pending") return fail(res, 409, "This request has already been reviewed.", "ALREADY_REVIEWED");
  const decision = String(req.body.decision || "");
  if (!(["approve", "decline"].includes(decision))) return fail(res, 400, "Decision must be approve or decline.", "VALIDATION_ERROR");
  request.status = decision === "approve" ? "approved" : "declined";
  request.decidedAt = new Date().toISOString();
  request.decidedBy = req.user.id;
  request.decisionNote = String(req.body.note || "").trim();
  if (decision === "approve") {
    const payment = getExtensionPayment(request);
    payment.dueDate = request.requestedPaymentDate;
    if (payment.amountPaid < payment.amount) payment.status = "extended";
  }
  addAuditEvent(req.user, `extension.${decision}d`, "extension", request.id);
  await saveStore();
  res.json({ item: request });
});

app.get("/api/relocations", authenticate, (req, res) => {
  let items = visibleRelocations(req.user);
  if (req.user.role === "tenant") items = items.filter((request) => request.tenantId === req.user.tenantId);
  if (req.query.status) items = items.filter((request) => request.status === req.query.status);
  const db = getStore();
  res.json({ items: items.map((request) => ({
    ...request,
    tenant: db.tenants.find((tenant) => tenant.id === request.tenantId),
    currentProperty: db.properties.find((property) => property.id === request.currentPropertyId),
    destinationProperty: db.properties.find((property) => property.id === request.destinationPropertyId) || null,
  })), count: items.length });
});

app.post("/api/relocations", authenticate, allowRoles("tenant"), async (req, res) => {
  const tenant = tenantForUser(req.user);
  if (!tenant) return fail(res, 404, "Tenant record not found.", "NOT_FOUND");
  const { moveType, requestedDate, destinationPropertyId, desiredUnit, reason, note } = req.body;
  if (!isDate(requestedDate) || !["internal", "external", "move_out"].includes(moveType)) return fail(res, 400, "Move type and a valid requested date are required.", "VALIDATION_ERROR");
  if (moveType === "internal" && !String(desiredUnit || "").trim()) return fail(res, 400, "Choose a destination unit for an internal move.", "VALIDATION_ERROR");
  if (moveType === "external" && destinationPropertyId && !propertyOr404(res, destinationPropertyId)) return;
  const request = {
    id: makeId("relocation"), tenantId: tenant.id, currentPropertyId: tenant.propertyId, currentUnit: tenant.unit,
    moveType, requestedDate, destinationPropertyId: destinationPropertyId || null, desiredUnit: desiredUnit || null,
    reason: String(reason || "other"), note: String(note || "").trim(), status: "pending", submittedAt: new Date().toISOString().slice(0, 10),
  };
  getStore().relocationRequests.push(request);
  addAuditEvent(req.user, "relocation.created", "relocation", request.id);
  await saveStore();
  res.status(201).json({ item: request });
});

app.patch("/api/relocations/:requestId", authenticate, allowRoles("landlord", "manager"), async (req, res) => {
  const request = getStore().relocationRequests.find((entry) => entry.id === req.params.requestId);
  if (!request) return fail(res, 404, "Relocation request not found.", "NOT_FOUND");
  if (!canAccessProperty(req.user, request.currentPropertyId)) return fail(res, 403, "You cannot update this request.", "FORBIDDEN");
  const status = String(req.body.status || "");
  if (!(["approved", "declined", "completed"].includes(status))) return fail(res, 400, "Status must be approved, declined, or completed.", "VALIDATION_ERROR");
  request.status = status;
  request.updatedAt = new Date().toISOString();
  request.updatedBy = req.user.id;
  if (req.body.destinationPropertyId) {
    if (!propertyOr404(res, req.body.destinationPropertyId)) return;
    request.destinationPropertyId = req.body.destinationPropertyId;
  }
  if (req.body.desiredUnit) request.desiredUnit = String(req.body.desiredUnit).trim();
  addAuditEvent(req.user, `relocation.${status}`, "relocation", request.id);
  await saveStore();
  res.json({ item: request });
});

app.get("/api/managers", authenticate, allowRoles("landlord"), (req, res) => {
  const db = getStore();
  const items = db.managers.map((assignment) => ({
    ...assignment,
    user: safeUser(db.users.find((user) => user.id === assignment.userId)),
    properties: assignment.propertyIds.map((id) => db.properties.find((property) => property.id === id)).filter(Boolean),
  }));
  res.json({ items, invitations: db.managerInvitations, count: items.length });
});

app.post("/api/managers/invitations", authenticate, allowRoles("landlord"), async (req, res) => {
  const { name, email, propertyIds } = req.body;
  const normalizedEmail = cleanEmail(email);
  if (!String(name || "").trim() || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || !Array.isArray(propertyIds) || propertyIds.length === 0) {
    return fail(res, 400, "Name, valid email, and at least one property are required.", "VALIDATION_ERROR");
  }
  if (getStore().users.some((user) => user.email === normalizedEmail) || getStore().managerInvitations.some((invite) => invite.email === normalizedEmail && invite.status === "pending")) {
    return fail(res, 409, "An account or pending invite already uses this email.", "EMAIL_IN_USE");
  }
  const visible = new Set(visiblePropertyIds(req.user));
  if (propertyIds.some((id) => !visible.has(id))) return fail(res, 403, "You can only assign properties you own.", "FORBIDDEN");
  const invitation = {
    id: makeId("invite"), name: String(name).trim(), email: normalizedEmail,
    propertyIds: [...new Set(propertyIds)], status: "pending", invitedBy: req.user.id, createdAt: new Date().toISOString(),
  };
  getStore().managerInvitations.push(invitation);
  addAuditEvent(req.user, "manager.invited", "manager_invitation", invitation.id);
  await saveStore();
  res.status(201).json({ item: invitation, message: "Invitation saved. Configure email delivery to send the sign-in link." });
});

app.get("/api/audit", authenticate, allowRoles("landlord"), (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
  res.json({ items: getStore().auditEvents.slice(0, limit) });
});

app.use("/api", (_req, res) => fail(res, 404, "API route not found.", "NOT_FOUND"));

app.use((error, _req, res, _next) => {
  if (error.message === "Origin is not allowed by CORS.") return fail(res, 403, error.message, "CORS_ORIGIN_DENIED");
  console.error(error);
  return fail(res, 500, "An unexpected server error occurred.", "INTERNAL_ERROR");
});

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  app.listen(port, () => {
    console.log(`Makazi Care API listening on http://localhost:${port}`);
    console.log("Demo accounts and API usage are documented in server/README.md");
  });
}

export default app;