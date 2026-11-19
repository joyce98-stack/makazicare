import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { buildEmptyData, buildSeedData } from "./data.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const databasePath = path.resolve(process.env.MAKAZI_CARE_DB_FILE || path.join(here, "data.json"));
let state;
let writeQueue = Promise.resolve();

async function writeSnapshot() {
  const serialized = JSON.stringify(state, null, 2);
  const temporaryPath = `${databasePath}.tmp`;
  await mkdir(path.dirname(databasePath), { recursive: true });
  await writeFile(temporaryPath, serialized, "utf8");
  await rename(temporaryPath, databasePath);
}

export async function initializeStore() {
  try {
    state = JSON.parse(await readFile(databasePath, "utf8"));
    state.tenantInvitations ||= [];
    return state;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Production data file is missing. Refusing to create demo accounts in production.");
  }
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  if (!adminEmail || !adminPassword) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD before creating a fresh data store.");
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
  if (process.env.SEED_DEMO_DATA === "false") {
    state = buildEmptyData(adminUser);
    await writeSnapshot();
    return state;
  }
  const demoPassword = process.env.DEMO_PASSWORD || "DemoPass123!";
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  state = buildSeedData(passwordHash, adminUser);
  await writeSnapshot();
  return state;
}

export function getStore() {
  if (!state) throw new Error("Store has not been initialized");
  return state;
}

export async function saveStore() {
  if (!state) throw new Error("Store has not been initialized");
  const snapshot = JSON.stringify(state, null, 2);
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    const temporaryPath = `${databasePath}.tmp`;
    await mkdir(path.dirname(databasePath), { recursive: true });
    await writeFile(temporaryPath, snapshot, "utf8");
    await rename(temporaryPath, databasePath);
  });
  await writeQueue;
}
