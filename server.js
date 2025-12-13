import express from "express";
import cors from "cors";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");
const PORT = Number(process.env.PORT) || 4000;
const IS_RAILWAY = Boolean(process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID || process.env.RAILWAY_ENVIRONMENT);
const IS_PRODUCTION = process.env.NODE_ENV === "production" || IS_RAILWAY;
const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? "" : "change-me-now");
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const gemini = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET nao configurado. Defina JWT_SECRET nas variaveis de ambiente (Railway > Variables).");
}

const demoTransactions = [
  { id: "t1", description: "Salario mensal", amount: 5200, date: "2024-12-05", type: "INCOME", category: "Salario", recurrence: "MONTHLY" },
  { id: "t2", description: "Aluguel", amount: 1500, date: "2024-12-08", type: "EXPENSE", category: "Moradia", recurrence: "MONTHLY" },
  { id: "t3", description: "Supermercado", amount: 420.5, date: "2024-12-10", type: "EXPENSE", category: "Alimentacao", recurrence: "NONE" },
  { id: "t4", description: "Investimento programado", amount: 350, date: "2024-12-12", type: "INCOME", category: "Investimentos", recurrence: "MONTHLY" },
];

const demoCards = [{ id: "c1", name: "Nubank", limit: 5000, dueDay: 10, closingDay: 3, color: "bg-purple-600" }];
const demoInvestments = [{ id: "i1", name: "Tesouro Selic", amount: 2000, type: "TESOURO", percentageOfCDI: 100, startDate: "2024-01-02" }];
const demoBudgets = [{ id: "b1", category: "Alimentacao", limit: 800 }];

const app = express();
app.disable("x-powered-by");

const corsOrigin = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors(corsOrigin?.length ? { origin: corsOrigin } : { origin: true }));
app.use(express.json({ limit: "1mb" }));

async function loadDB() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const seeded = createSeed();
    await fs.writeFile(DATA_FILE, JSON.stringify(seeded, null, 2));
    return seeded;
  }
}

async function saveDB(db) {
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2));
}

function createSeed() {
  const passwordHash = bcrypt.hashSync("123456", 10);
  const demoId = "demo-user";
  return {
    users: [{ id: demoId, email: "demo@financas.com", name: "Conta Demo", passwordHash }],
    finances: {
      [demoId]: {
        transactions: demoTransactions,
        cards: demoCards,
        investments: demoInvestments,
        budgets: demoBudgets,
      },
    },
  };
}

function ensureFinances(db, userId) {
  if (!db.finances[userId]) {
    db.finances[userId] = { transactions: [], cards: [], investments: [], budgets: [] };
  }
  return db.finances[userId];
}

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

function readText(response) {
  if (response?.response?.text) return response.response.text();
  return response?.text;
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ message: "Token ausente" });
  }
  const token = header.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token invalido" });
  }
}

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.post("/api/ai/insight", authMiddleware, async (req, res) => {
  if (!gemini) {
    return res.json({
      title: "IA desativada",
      message: "Configure GEMINI_API_KEY (ou GOOGLE_API_KEY) no servidor para receber insights.",
      type: "warning",
    });
  }

  const { context } = req.body || {};
  if (!context || typeof context !== "string") {
    return res.status(400).json({ message: "context deve ser uma string" });
  }

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analise estes dados financeiros e forneca um insight curto e acionavel em JSON.

${context}

Responda APENAS com o JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            message: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["success", "warning", "info"] },
          },
        },
      },
    });

    return res.json(JSON.parse(readText(response)));
  } catch (error) {
    console.error("Erro ao gerar insight (Gemini):", error);
    return res.json({
      title: "Erro na Analise",
      message: "Nao foi possivel conectar ao assistente financeiro no momento.",
      type: "info",
    });
  }
});

app.post("/api/ai/advisor", authMiddleware, async (req, res) => {
  if (!gemini) {
    return res.status(503).json({ message: "GEMINI_API_KEY nao configurado no servidor" });
  }

  const { question, dataContext } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ message: "question deve ser uma string" });
  }

  const safeDataContext = typeof dataContext === "string" ? dataContext : "";

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Voce e um consultor financeiro. Use APENAS os dados abaixo que o usuario permitiu compartilhar:

${safeDataContext}

Se os dados para responder a pergunta nao estiverem disponiveis (ex: usuario perguntou de investimentos mas nao compartilhou), avise educadamente.

Pergunta do usuario: "${question}"

Responda em Markdown.`,
    });

    return res.json({ answer: readText(response) || "" });
  } catch (error) {
    console.error("Erro ao responder (Gemini):", error);
    return res.status(500).json({ message: "Nao foi possivel conectar ao assistente financeiro no momento." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ message: "Email, senha e nome sao obrigatorios" });
  }

  const db = await loadDB();
  const existing = db.users.find((u) => u.email === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ message: "Email ja cadastrado" });
  }

  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: userId, email: email.toLowerCase(), name, passwordHash };
  db.users.push(user);
  db.finances[userId] = { transactions: [...demoTransactions], cards: [...demoCards], investments: [...demoInvestments], budgets: [...demoBudgets] };
  await saveDB(db);

  const token = signToken(userId);
  return res.json({ token, user: { id: userId, email: user.email, name: user.name } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email e senha sao obrigatorios" });
  }

  const db = await loadDB();
  const user = db.users.find((u) => u.email === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ message: "Credenciais invalidas" });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ message: "Credenciais invalidas" });
  }

  const token = signToken(user.id);
  ensureFinances(db, user.id);
  await saveDB(db);

  return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  const db = await loadDB();
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) {
    return res.status(404).json({ message: "Usuario nao encontrado" });
  }
  return res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

app.get("/api/data", authMiddleware, async (req, res) => {
  const db = await loadDB();
  const finances = ensureFinances(db, req.userId);
  await saveDB(db);
  return res.json(finances);
});

app.post("/api/transactions/bulk", authMiddleware, async (req, res) => {
  const { transactions } = req.body || {};
  if (!Array.isArray(transactions)) {
    return res.status(400).json({ message: "transactions deve ser uma lista" });
  }

  const db = await loadDB();
  const finances = ensureFinances(db, req.userId);
  const created = transactions.map(normalizeTransaction);
  finances.transactions = [...created, ...finances.transactions];
  db.finances[req.userId] = finances;
  await saveDB(db);
  return res.status(201).json({ transactions: created });
});

app.delete("/api/transactions/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const db = await loadDB();
  const finances = ensureFinances(db, req.userId);
  finances.transactions = finances.transactions.filter((t) => t.id !== id);
  db.finances[req.userId] = finances;
  await saveDB(db);
  return res.status(204).end();
});

app.post("/api/cards", authMiddleware, async (req, res) => {
  const db = await loadDB();
  const finances = ensureFinances(db, req.userId);
  const card = normalizeCard(req.body || {});
  finances.cards = [...finances.cards, card];
  db.finances[req.userId] = finances;
  await saveDB(db);
  return res.status(201).json({ card });
});

app.delete("/api/cards/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const db = await loadDB();
  const finances = ensureFinances(db, req.userId);
  finances.cards = finances.cards.filter((c) => c.id !== id);
  db.finances[req.userId] = finances;
  await saveDB(db);
  return res.status(204).end();
});

app.post("/api/investments", authMiddleware, async (req, res) => {
  const db = await loadDB();
  const finances = ensureFinances(db, req.userId);
  const investment = normalizeInvestment(req.body || {});
  finances.investments = [...finances.investments, investment];
  db.finances[req.userId] = finances;
  await saveDB(db);
  return res.status(201).json({ investment });
});

app.delete("/api/investments/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const db = await loadDB();
  const finances = ensureFinances(db, req.userId);
  finances.investments = finances.investments.filter((i) => i.id !== id);
  db.finances[req.userId] = finances;
  await saveDB(db);
  return res.status(204).end();
});

app.post("/api/budgets", authMiddleware, async (req, res) => {
  const db = await loadDB();
  const finances = ensureFinances(db, req.userId);
  const budget = normalizeBudget(req.body || {});
  finances.budgets = [...finances.budgets, budget];
  db.finances[req.userId] = finances;
  await saveDB(db);
  return res.status(201).json({ budget });
});

app.delete("/api/budgets/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const db = await loadDB();
  const finances = ensureFinances(db, req.userId);
  finances.budgets = finances.budgets.filter((b) => b.id !== id);
  db.finances[req.userId] = finances;
  await saveDB(db);
  return res.status(204).end();
});

const DIST_DIR = path.join(__dirname, "dist");
const DIST_INDEX = path.join(DIST_DIR, "index.html");
if (existsSync(DIST_DIR) && existsSync(DIST_INDEX)) {
  app.use(express.static(DIST_DIR, { index: false }));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(DIST_INDEX));
}

function normalizeTransaction(input) {
  return {
    id: input.id || randomUUID(),
    description: input.description ? String(input.description) : "Transacao",
    amount: Number(input.amount) || 0,
    date: input.date || new Date().toISOString().split("T")[0],
    type: input.type === "INCOME" ? "INCOME" : "EXPENSE",
    category: input.category || "Geral",
    recurrence: input.recurrence || "NONE",
    isInstallment: Boolean(input.isInstallment),
    installmentCurrent: input.installmentCurrent,
    installmentTotal: input.installmentTotal,
    cardId: input.cardId,
  };
}

function normalizeCard(input) {
  return {
    id: input.id || randomUUID(),
    name: input.name || "Cartao",
    limit: Number(input.limit) || 0,
    dueDay: Number(input.dueDay) || 1,
    closingDay: Number(input.closingDay) || 1,
    color: input.color || "bg-indigo-600",
  };
}

function normalizeInvestment(input) {
  return {
    id: input.id || randomUUID(),
    name: input.name || "Investimento",
    amount: Number(input.amount) || 0,
    type: input.type || "CDB",
    percentageOfCDI: Number(input.percentageOfCDI) || 100,
    startDate: input.startDate || new Date().toISOString().split("T")[0],
  };
}

function normalizeBudget(input) {
  return {
    id: input.id || randomUUID(),
    category: input.category || "Geral",
    limit: Number(input.limit) || 0,
  };
}

app.use((err, _req, res, _next) => {
  console.error("Server error", err);
  return res.status(500).json({ message: "Erro interno" });
});

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
