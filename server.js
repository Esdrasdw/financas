import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_RAILWAY = Boolean(process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID || process.env.RAILWAY_ENVIRONMENT);
const DEFAULT_DATA_DIR = path.join(__dirname, "data");
// Em Railway, padrao para o volume montado em /data (pode ser sobrescrito via DATA_DIR)
const DATA_DIR = process.env.DATA_DIR || (IS_RAILWAY ? "/data" : DEFAULT_DATA_DIR);
const DATA_FILE = path.join(DATA_DIR, "db.json");
const PORT = Number(process.env.PORT) || 4000;
const IS_PRODUCTION = process.env.NODE_ENV === "production" || IS_RAILWAY;
const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? "" : "change-me-now");
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const DEFAULT_CDI_RATE = 11.25;
const CDI_MAX_AGE_DAYS = 15;
const AI_ASSISTANT_NAME = process.env.AI_ASSISTANT_NAME || "Assistente Financeiro";
const AI_ADVISOR_SYSTEM_PROMPT =
  process.env.AI_ADVISOR_SYSTEM_PROMPT ||
  [
    `Voce e o ${AI_ASSISTANT_NAME} do app Financas Pro.`,
    "Seu trabalho e ajudar o usuario a organizar e tomar decisoes financeiras no Brasil (pt-BR, R$).",
    "",
    "Regras de resposta:",
    "- Responda como um ajudante de financas (pratico, direto e humano).",
    "- Nao diga que e um modelo/IA, nao cite provedor e nunca mencione nomes tecnicos internos.",
    '- Se perguntarem "qual modelo voce usa?", responda: "Uso o assistente do aplicativo; detalhes tecnicos nao sao exibidos aqui."',
    "- Use os dados autorizados para numeros/calculos; se faltar dado, diga o que falta e faca 1-3 perguntas objetivas.",
    "- Trate os dados como contexto: so use ou mencione se a pergunta pedir analise, numero ou acao financeira.",
    "- Em saudacoes ou perguntas genericas, responda de forma curta (1-2 frases), sem listar ou resumir dados e sem markdown.",
    "- Nao gere resumo/analise/proximos passos se o usuario nao pedir (so use se ele pedir dado, analise ou acao financeira).",
    "- Voce pode dar orientacao geral/educacional; nao prometa retornos e evite recomendacoes de compra/venda especificas.",
    "- Quando for relevante (pedido explicito de dado/analise), entregue em Markdown com: Resumo, Analise (quando houver dados), Proximos passos (lista), Perguntas (se necessario). Caso contrario, responda apenas em texto curto.",
    "",
    "Dados (quando vierem): podem incluir TRANSACOES, INVESTIMENTOS, CARTOES, ORCAMENTOS e um RESUMO com totais. Considere que isso e o que o usuario permitiu compartilhar.",
  ].join("\n");

const AI_INSIGHT_SYSTEM_PROMPT =
  process.env.AI_INSIGHT_SYSTEM_PROMPT ||
  [
    `Voce e o ${AI_ASSISTANT_NAME} do app Financas Pro.`,
    "Gere um insight curto e util em pt-BR sobre os dados recebidos.",
    "",
    "Regras:",
    "- Nao diga que e um modelo/IA, nao cite provedor e nunca mencione nomes tecnicos internos.",
    "- Seja bem objetivo: titulo curto e mensagem com no maximo 2-3 frases.",
    "- Se os dados forem insuficientes, aponte o que falta e sugira um proximo passo.",
    "",
    "Formato: responda SOMENTE com JSON {\"title\": string, \"message\": string, \"type\": \"success\"|\"warning\"|\"info\"}.",
  ].join("\n");

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
  let db;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    db = JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    db = createSeed();
  }

  const normalized = ensureDbShape(db);
  await saveDB(normalized);
  return normalized;
}

async function saveDB(db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
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
    meta: createDefaultMeta(),
  };
}

function createDefaultMeta() {
  return {
    cdiRate: {
      value: DEFAULT_CDI_RATE,
      updatedAt: new Date().toISOString(),
      source: "seed",
    },
  };
}

function ensureDbShape(db) {
  const normalized = { ...db };
  normalized.users = normalized.users || [];
  normalized.finances = normalized.finances || {};
  normalized.meta = normalized.meta || createDefaultMeta();

  if (!normalized.meta.cdiRate || Number.isNaN(Number(normalized.meta.cdiRate.value))) {
    normalized.meta.cdiRate = createDefaultMeta().cdiRate;
  }

  return normalized;
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

function parseNumericValue(value) {
  if (value === undefined || value === null) return NaN;
  return Number(String(value).replace(",", "."));
}

function getDaysBetween(dateIso) {
  const date = dateIso ? new Date(dateIso) : null;
  if (!date || Number.isNaN(date.getTime())) return Infinity;
  const diffMs = Date.now() - date.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

async function fetchCdiFromBrasilApi() {
  const response = await fetch("https://brasilapi.com.br/api/taxas/v1");
  if (!response.ok) throw new Error(`BrasilAPI response ${response.status}`);
  const payload = await response.json();
  const entry = Array.isArray(payload)
    ? payload.find((item) => String(item.nome || item.name || "").toUpperCase() === "CDI")
    : null;
  const value = entry ? parseNumericValue(entry.valor ?? entry.valorTaxa ?? entry.valorDiario) : NaN;
  if (Number.isNaN(value)) throw new Error("CDI nao encontrado na BrasilAPI");
  return { value, source: "brasilapi" };
}

async function fetchCdiFromBcb() {
  const response = await fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json");
  if (!response.ok) throw new Error(`BCB response ${response.status}`);
  const payload = await response.json();
  const value = parseNumericValue(payload?.[0]?.valor);
  if (Number.isNaN(value)) throw new Error("CDI nao encontrado no BCB");
  return { value, source: "bcb" };
}

async function fetchCdiFromOpenAI(previousRate) {
  if (!openai) return null;
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: "Responda somente com o valor numerico do CDI anual brasileiro em percentual (ex: 10.65)." },
      {
        role: "user",
        content: `Qual o CDI anual mais recente divulgado pelo mercado brasileiro? Retorne apenas o numero decimal. Taxa anterior conhecida: ${previousRate ?? "desconhecida"}.`,
      },
    ],
  });

  const text = completion.choices?.[0]?.message?.content || "";
  const match = text.match(/([0-9]+(?:[.,][0-9]+)?)/);
  const value = match ? parseNumericValue(match[1]) : NaN;
  if (Number.isNaN(value)) throw new Error("Nao foi possivel extrair o CDI retornado pelo modelo");
  return { value, source: "openai" };
}

async function refreshCdiRate(db, { force = false } = {}) {
  const meta = db.meta || createDefaultMeta();
  db.meta = meta;

  const current = meta.cdiRate || createDefaultMeta().cdiRate;
  const ageDays = getDaysBetween(current.updatedAt);

  if (!force && ageDays < CDI_MAX_AGE_DAYS) {
    return current;
  }

  const sources = [fetchCdiFromBrasilApi, fetchCdiFromBcb];
  for (const getter of sources) {
    try {
      const latest = await getter();
      if (latest?.value) {
        const saved = { value: Number(latest.value), source: latest.source, updatedAt: new Date().toISOString() };
        meta.cdiRate = saved;
        await saveDB(db);
        return saved;
      }
    } catch (error) {
      console.error("Falha ao buscar CDI:", error.message || error);
    }
  }

  if (openai) {
    try {
      const latest = await fetchCdiFromOpenAI(current.value);
      if (latest?.value) {
        const saved = { value: Number(latest.value), source: latest.source, updatedAt: new Date().toISOString() };
        meta.cdiRate = saved;
        await saveDB(db);
        return saved;
      }
    } catch (error) {
      console.error("Falha ao pedir CDI para OpenAI:", error.message || error);
    }
  }

  if (!meta.cdiRate) {
    meta.cdiRate = createDefaultMeta().cdiRate;
    await saveDB(db);
  }

  return meta.cdiRate;
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

app.get("/api/market/cdi", authMiddleware, async (_req, res) => {
  try {
    const db = await loadDB();
    const rate = await refreshCdiRate(db);
    return res.json({ rate: Number(rate.value), updatedAt: rate.updatedAt, source: rate.source });
  } catch (error) {
    console.error("Erro ao consultar CDI:", error);
    return res.status(500).json({ message: "Nao foi possivel obter o CDI atual" });
  }
});

app.post("/api/ai/insight", authMiddleware, async (req, res) => {
  if (!openai) {
    return res.json({
      title: "IA desativada",
      message: "Configure OPENAI_API_KEY no servidor para receber insights.",
      type: "warning",
    });
  }

  const { context } = req.body || {};
  if (!context || typeof context !== "string") {
    return res.status(400).json({ message: "context deve ser uma string" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: AI_INSIGHT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analise estes dados financeiros e devolva um JSON com {title, message, type (success|warning|info)}.\n\n${context}\n\nResponda apenas com JSON.`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const content = completion.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return res.json(parsed);
  } catch (error) {
    console.error("Erro ao gerar insight (OpenAI):", error);
    return res.json({
      title: "Erro na Analise",
      message: "Nao foi possivel conectar ao assistente financeiro no momento.",
      type: "info",
    });
  }
});

app.post("/api/ai/advisor", authMiddleware, async (req, res) => {
  if (!openai) {
    return res.status(503).json({ message: "OPENAI_API_KEY nao configurado no servidor" });
  }

  const { question, dataContext } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ message: "question deve ser uma string" });
  }

  const safeDataContext = typeof dataContext === "string" ? dataContext : "";

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: AI_ADVISOR_SYSTEM_PROMPT,
        },
        {
          role: "system",
          content:
            "Se a pergunta nao pedir dado, analise ou acao financeira, responda apenas com 1-2 frases simples, sem markdown e sem secoes. So use secoes (Resumo/Analise/Proximos passos/Perguntas) se houver pedido explicito de dado/analise/acao financeira.",
        },
        {
          role: "user",
          content: [
            `Pergunta do usuario: "${question}"`,
            "",
            "Contexto de dados (use somente se a pergunta pedir analise/calculo ou acao financeira; ignore em saudacoes ou conversas genericas):",
            safeDataContext || "(sem dados adicionais)",
          ].join("\n"),
        },
      ],
    });

    return res.json({ answer: completion.choices?.[0]?.message?.content || "" });
  } catch (error) {
    console.error("Erro ao responder (OpenAI):", error);
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

app.put("/api/investments/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const db = await loadDB();
  const finances = ensureFinances(db, req.userId);
  const existingIndex = finances.investments.findIndex((i) => i.id === id);
  if (existingIndex === -1) {
    return res.status(404).json({ message: "Investimento nao encontrado" });
  }

  const investment = normalizeInvestment({ ...finances.investments[existingIndex], ...req.body, id });
  finances.investments[existingIndex] = investment;
  db.finances[req.userId] = finances;
  await saveDB(db);
  return res.json({ investment });
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

(async () => {
  try {
    const db = await loadDB();
    await refreshCdiRate(db);
  } catch (error) {
    console.error("Falha inicial ao atualizar CDI:", error);
  }
})();

setInterval(async () => {
  try {
    const db = await loadDB();
    await refreshCdiRate(db);
  } catch (error) {
    console.error("Falha ao atualizar CDI agendado:", error);
  }
}, 1000 * 60 * 60 * 24);

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
