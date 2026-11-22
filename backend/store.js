import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFile } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import { buildEmptyData, buildSeedData } from "./data.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const legacySqlitePath = path.resolve(process.env.MAKAZI_CARE_SQLITE_FILE || path.join(here, "makazi-care.sqlite"));
const legacyJsonPath = path.resolve(process.env.MAKAZI_CARE_LEGACY_DATA_FILE || path.join(here, "data.json"));
const collectionNames = [
  "users", "properties", "tenants", "payments", "maintenanceRequests", "extensionRequests",
  "relocationRequests", "managers", "managerInvitations", "tenantInvitations", "collectionTransactions", "auditEvents",
];
let mongoClient;
let mongoDatabase;
let state;
let writeQueue = Promise.resolve();

async function connectDatabase() {
  if (mongoDatabase) return mongoDatabase;
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("Set MONGODB_URI in .env to connect to MongoDB Atlas.");
  mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await mongoClient.connect();
  mongoDatabase = mongoClient.db(process.env.MONGODB_DB_NAME?.trim() || "makazicare");
  await mongoDatabase.command({ ping: 1 });
  return mongoDatabase;
}

function idFor(entry, collectionName, index) {
  return String(entry.id || entry.userId || `${collectionName}-${index}`);
}

async function readMongoState() {
  const db = await connectDatabase();
  const versionRecord = await db.collection("app_metadata").findOne({ _id: "version" });
  const result = { version: Number(versionRecord?.value || 1) };
  for (const name of collectionNames) {
    const records = await db.collection(name).find({}, { projection: { data: 1, order: 1 } }).sort({ order: 1, _id: 1 }).toArray();
    result[name] = records.map((record) => record.data);
  }
  return result;
}

function hasData(data) {
  return collectionNames.some((name) => data[name]?.length);
}

function loadSqliteState() {
  if (!existsSync(legacySqlitePath)) return null;
  const oldDatabase = new DatabaseSync(legacySqlitePath, { readOnly: true });
  try {
    const result = { version: Number(oldDatabase.prepare("SELECT value FROM app_metadata WHERE key = 'version'").get()?.value || 1) };
    for (const name of collectionNames) {
      result[name] = oldDatabase.prepare(`SELECT data FROM ${name} ORDER BY rowid`).all().map((row) => JSON.parse(row.data));
    }
    return result;
  } finally {
    oldDatabase.close();
  }
}

async function loadLegacyState() {
  const sqliteState = loadSqliteState();
  if (sqliteState && hasData(sqliteState)) return sqliteState;
  try {
    const jsonState = JSON.parse(await readFile(legacyJsonPath, "utf8"));
    if (!hasData(jsonState)) return null;
    return { version: jsonState.version || 1, ...Object.fromEntries(collectionNames.map((name) => [name, jsonState[name] || []])) };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeSnapshot(snapshot) {
  const db = await connectDatabase();
  for (const name of collectionNames) {
    const collection = db.collection(name);
    const records = snapshot[name].map((entry, index) => ({ _id: idFor(entry, name, index), data: entry, order: index }));
    if (records.length) {
      await collection.bulkWrite(records.map((record) => ({
        replaceOne: { filter: { _id: record._id }, replacement: record, upsert: true },
      })), { ordered: true });
      await collection.deleteMany({ _id: { $nin: records.map((record) => record._id) } });
    } else {
      await collection.deleteMany({});
    }
  }
  await db.collection("app_metadata").updateOne(
    { _id: "version" },
    { $set: { value: snapshot.version || 1 } },
    { upsert: true },
  );
}

function normalizedState(data) {
  const normalized = { version: data.version || 1 };
  for (const name of collectionNames) normalized[name] = data[name] || [];
  normalized.tenantInvitations ||= [];
  normalized.collectionTransactions ||= [];
  for (const tenant of normalized.tenants) {
    if (!tenant.paymentReference) tenant.paymentReference = `MC${tenant.id.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(-10)}`;
  }
  return normalized;
}

export async function initializeStore() {
  const existing = await readMongoState();
  if (hasData(existing)) {
    state = normalizedState(existing);
    return state;
  }

  const legacy = await loadLegacyState();
  if (legacy) {
    state = normalizedState(legacy);
    await writeSnapshot(state);
    return state;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("MongoDB is empty and no legacy database file was found. Refusing to create demo accounts in production.");
  }
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  if (!adminEmail || !adminPassword) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD before creating a fresh database.");
  }
  if (!/^\S+@\S+\.\S+$/.test(adminEmail) || adminPassword.length < 16 || adminPassword.startsWith("replace-with-")) {
    throw new Error("ADMIN_EMAIL must be valid and ADMIN_PASSWORD must be a unique password of at least 16 characters.");
  }
  const adminUser = {
    id: "user-system-admin",
    name: "System Administrator",
    email: adminEmail,
    role: "admin",
    passwordHash: await bcrypt.hash(adminPassword, 12),
  };
  if (process.env.SEED_DEMO_DATA !== "true") {
    state = buildEmptyData(adminUser);
  } else {
    const demoPassword = process.env.DEMO_PASSWORD || "DemoPass123!";
    const passwordHash = await bcrypt.hash(demoPassword, 10);
    state = buildSeedData(passwordHash, adminUser);
  }
  state = normalizedState(state);
  await writeSnapshot(state);
  return state;
}

export function getStore() {
  if (!state) throw new Error("Store has not been initialized");
  return state;
}

export async function saveStore() {
  if (!state) throw new Error("Store has not been initialized");
  const snapshot = JSON.parse(JSON.stringify(state));
  writeQueue = writeQueue.catch(() => {}).then(() => writeSnapshot(snapshot));
  await writeQueue;
}

export async function databaseHealth() {
  try {
    const db = await connectDatabase();
    await db.command({ ping: 1 });
    return { connected: true, type: "mongodb", database: db.databaseName };
  } catch {
    return { connected: false, type: "mongodb", database: process.env.MONGODB_DB_NAME?.trim() || "makazicare" };
  }
}
