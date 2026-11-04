import crypto from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getStorageDirectory } from "./paths";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
}

export type SafeUser = Omit<User, "passwordHash" | "salt">;

const AUTH_SECRET = process.env.AUTH_SECRET || "engineering-doubt-solver-secret-key-2026";

function getUsersFile(): string {
  const dir = getStorageDirectory();
  return path.join(dir, "users.json");
}

function loadUsers(): User[] {
  const usersFile = getUsersFile();
  if (!existsSync(usersFile)) {
    return [];
  }
  try {
    const raw = readFileSync(usersFile, "utf8");
    return JSON.parse(raw) as User[];
  } catch {
    return [];
  }
}

function saveUsers(users: User[]): void {
  const usersFile = getUsersFile();
  writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

export function createToken(userId: string): string {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt })).toString("base64url");
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;

    const expectedSig = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
    if (signature !== expectedSig) return null;

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId: string;
      expiresAt: number;
    };

    if (Date.now() > decoded.expiresAt) return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

export function registerUser(name: string, email: string, password: string): { user: SafeUser; token: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }
  if (!cleanName || cleanName.length < 2) {
    throw new Error("Name must be at least 2 characters long.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const users = loadUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    throw new Error("An account with this email already exists.");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const id = `user_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const newUser: User = {
    id,
    name: cleanName,
    email: cleanEmail,
    passwordHash,
    salt,
    createdAt: Date.now(),
  };

  users.push(newUser);
  saveUsers(users);

  const token = createToken(id);
  const safeUser: SafeUser = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    createdAt: newUser.createdAt,
  };
  return { user: safeUser, token };
}

export function loginUser(email: string, password: string): { user: SafeUser; token: string } {
  const cleanEmail = email.trim().toLowerCase();
  const users = loadUsers();
  const user = users.find((u) => u.email === cleanEmail);

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    throw new Error("Invalid email or password.");
  }

  const token = createToken(user.id);
  const safeUser: SafeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
  return { user: safeUser, token };
}

export function getUserById(id: string): SafeUser | null {
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}
