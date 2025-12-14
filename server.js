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
import pdfParse from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_RAILWAY = Boolean(process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID || process.env.RAILWAY_ENVIRONMENT);
const DEFAULT_DATA_DIR = path.join(__dirname, "data");
// Em Railway, padrao para o volume montado em /data (pode ser sobrescrito via DATA_DIR)
const DATA_DIR = process.env.DATA_DIR || (IS_RAILWAY ? "/data" : DEFAULT_DATA_DIR);
const DATA_FILE = path.join(DATA_DIR, "db.json");
const DATA_TMP_FILE = `${DATA_FILE}.tmp`;
const DATA_BACKUP_FILE = `${DATA_FILE}.bak`;
let pendingSave = Promise.resolve();
const PORT = Number(process.env.PORT) || 4000;
const IS_PRODUCTION = process.env.NODE_ENV === "production" || IS_RAILWAY;
const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? "" : "change-me-now");
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const DEFAULT_CDI_RATE = 11.25;
const CDI_MAX_AGE_DAYS = 15;
const PAYMENT_METHODS = ["PIX", "CASH", "CARD"];
const PAYMENT_STATUS = ["PENDING", "PAID"];
const AI_ASSISTANT_NAME = process.env.AI_ASSISTANT_NAME || "Assistente Financeiro";
const AI_ADVISOR_SYSTEM_PROMPT =
  process.env.AI_ADVISOR_SYSTEM_PROMPT ||
  [
    `Voce e o ${AI_ASSISTANT_NAME} do app Financas Pro.`,
    "Ajude de forma pratica e direta usuarios no Brasil (pt-BR, R$) a tomarem decisoes financeiras mes a mes e no longo prazo.",
    "",
    "Regras de resposta:",
    "- Nao mencione IA/modelo/provedor; seja um assistente humano e confiavel.",
    '- Se perguntarem "qual modelo voce usa?", responda: "Uso o assistente do aplicativo; detalhes tecnicos nao sao exibidos aqui."',
    "- Se faltar dado, diga o que falta e faca 1-3 perguntas objetivas para prosseguir.",
    "- Use dados compartilhados apenas quando a pergunta pedir analise/calculo ou acao financeira. Em saudacoes, responda curto (1-2 frases).",
    "- Quando fizer sentido, entregue em Markdown com secoes: Resumo, Analise (quando houver dados), Proximos passos (lista) e Perguntas (se necessario).",
    "- Nunca prometa retornos, evite recomendacoes de compra/venda especificas e priorize seguranca e simplicidade.",
    "",
    "Dados (quando vierem): podem incluir TRANSACOES, INVESTIMENTOS, CARTOES, ORCAMENTOS e um RESUMO com totais. Considere que isso e o que o usuario permitiu compartilhar.",
  ].join("\n");

const AI_INSIGHT_SYSTEM_PROMPT =
  process.env.AI_INSIGHT_SYSTEM_PROMPT ||
  [
    `Voce e o ${AI_ASSISTANT_NAME} do app Financas Pro.`,
    "Gere um insight curto e util em pt-BR sobre os dados recebidos, com foco no mes atual e alertas futuros.",
    "",
    "Regras:",
    "- Nao diga que e um modelo/IA, nao cite provedor e nunca mencione nomes tecnicos internos.",
    "- Seja bem objetivo: titulo curto e mensagem com no maximo 2-3 frases.",
    "- Se os dados forem insuficientes, aponte o que falta e sugira um proximo passo.",
    "- Se houver parcelas ou faturas pendentes, cite o valor total pendente.",
    "",
    "Formato: responda SOMENTE com JSON {\"title\": string, \"message\": string, \"type\": \"success\"|\"warning\"|\"info\"}.",
  ].join("\n");

const AI_IMPORT_SYSTEM_PROMPT =
  process.env.AI_IMPORT_SYSTEM_PROMPT ||
  [
    "Voce ajuda a transformar extratos, faturas, holerites, planilhas ou descricoes livres em lancamentos financeiros.",
    "Leia o texto enviado e responda apenas com JSON no formato {\"transactions\": Array<Transacao>}",
    "Transacao: {description: string, amount: number, type: \"INCOME\"|\"EXPENSE\", category?: string, date?: string, paymentMethod?: \"PIX\"|\"CASH\"|\"CARD\", isInstallment?: boolean, installmentTotal?: number, installmentsPaid?: number, status?: \"PENDING\"|\"PAID\"}",
    "Regras:",
    "- Responda SOMENTE com JSON. Nao use markdown.",
    "- Se nao houver data, use a data de referencia fornecida pelo sistema.",
    "- Use INCOME para salarios, recebimentos, reembolsos ou entradas; EXPENSE para faturas, boletos, impostos ou compras.",
    "- Categorize de forma simples: Salario, Moradia, Alimentacao, Transporte, Lazer, Investimentos, Impostos, Taxas, Compras, Outros.",
    "- Preencha paymentMethod quando possivel: PIX (transferencia/PIX), CASH (dinheiro) ou CARD (cartao).",
    "- Se for fatura/extrato de cartao: considere apenas gastos (type=EXPENSE), ignore pagamentos/limites/creditos e use paymentMethod=CARD e status=PENDING.",
    "- Compras parceladas: marque isInstallment=true, informe installmentTotal e installmentsPaid se ja houve pagamento. amount DEVE ser o valor de cada parcela (nao divida o valor informado).",
    "- Escreva descricoes curtas e limpas (ate 40 caracteres), sem sufixos tecnicos ou codigos de autorizacao.",
    "- Pagamentos futuros/fatura aberta: status deve ser PENDING.",
    "- Pode retornar varias transacoes (varios produtos) no mesmo JSON; cada item representa um lancamento ou compra/parcelamento.",
    "- Se o arquivo for um resumo geral (ex: limite do cartao), ignore e retorne lista vazia.",
  ].join("\n");

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET nao configurado. Defina JWT_SECRET nas variaveis de ambiente (Railway > Variables).");
}

const demoTransactions = [
  {
    id: "t1",
    description: "Salario mensal",
    amount: 5200,
    date: "2024-12-05",
    type: "INCOME",
    category: "Salario",
    recurrence: "MONTHLY",
    paymentMethod: "PIX",
  },
  {
    id: "t2",
    description: "Aluguel",
    amount: 1500,
    date: "2024-12-08",
    type: "EXPENSE",
    category: "Moradia",
    recurrence: "MONTHLY",
    paymentMethod: "PIX",
  },
  {
    id: "t3",
    description: "Supermercado",
    amount: 420.5,
    date: "2024-12-10",
    type: "EXPENSE",
    category: "Alimentacao",
    recurrence: "NONE",
    paymentMethod: "CARD",
  },
  {
    id: "t4",
    description: "Investimento programado",
    amount: 350,
    date: "2024-12-12",
    type: "INCOME",
    category: "Investimentos",
    recurrence: "MONTHLY",
    paymentMethod: "PIX",
  },
];

const demoCards = [{ id: "c1", name: "Nubank", limit: 5000, dueDay: 10, closingDay: 3, color: "bg-purple-600" }];
const demoInvestments = [
  {
    id: "i1",
    name: "Tesouro Selic",
    amount: 2000,
    type: "TESOURO",
    percentageOfCDI: 100,
    startDate: "2024-01-02",
    contributions: [{ id: "i1-c1", amount: 2000, date: "2024-01-02" }],
  },
];
const demoBudgets = [{ id: "b1", category: "Alimentacao", limit: 800 }];
const demoGoals = [
  { id: "g1", title: "Reserva de Emergencia", target: 15000, current: 4500, deadline: "2025-12-31", category: "Seguranca" },
  { id: "g2", title: "Viagem", target: 8000, current: 2500, deadline: "2025-06-30", category: "Lazer" },
];

const app = express();
app.disable("x-powered-by");

const corsOrigin = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors(corsOrigin?.length ? { origin: corsOrigin } : { origin: true }));
app.use(express.json({ limit: "10mb" }));

async function loadDB() {
  // Aguarda gravacoes anteriores terminarem para evitar leituras de arquivo parcialmente escrito
  await pendingSave;
  await fs.mkdir(DATA_DIR, { recursive: true });
  let db;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    db = JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      db = createSeed();
    } else {
      console.error("DB corrompido, tentando restaurar backup:", error.message || error);
      const restored = await tryRestoreBackup();
      if (restored) {
        db = restored;
      } else {
        console.error("Backup indisponivel, recriando seed:", error.message || error);
        db = createSeed();
      }
    }
  }

  const normalized = ensureDbShape(db);
  await saveDB(normalized);
  return normalized;
}

async function saveDB(db) {
  const payload = JSON.stringify(db, null, 2);
  // Serializa gravacoes para evitar corrupcao por escrita concorrente
  pendingSave = pendingSave
    .catch(() => null)
    .then(() => writeDbAtomic(payload))
    .catch((error) => {
      console.error("Falha ao salvar DB:", error.message || error);
    });
  return pendingSave;
}

async function writeDbAtomic(content) {
  await fs.mkdir(DATA_DIR, { recursive: true });

  if (existsSync(DATA_FILE)) {
    try {
      await fs.copyFile(DATA_FILE, DATA_BACKUP_FILE);
    } catch (error) {
      console.error("Nao foi possivel salvar backup do DB:", error.message || error);
    }
  }

  await fs.writeFile(DATA_TMP_FILE, content, "utf-8");

  try {
    await fs.rm(DATA_FILE, { force: true });
    await fs.rename(DATA_TMP_FILE, DATA_FILE);
  } catch (error) {
    console.error("Falha ao trocar arquivo do DB de forma atomica, tentando escrita direta:", error.message || error);
    await fs.writeFile(DATA_FILE, content, "utf-8");
    await fs.rm(DATA_TMP_FILE, { force: true });
  }
}

async function tryRestoreBackup() {
  if (!existsSync(DATA_BACKUP_FILE)) return null;
  try {
    const raw = await fs.readFile(DATA_BACKUP_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Falha ao ler backup do DB:", error.message || error);
    return null;
  }
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
        goals: demoGoals,
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

  Object.keys(normalized.finances).forEach((userId) => {
    const defaults = { transactions: [], cards: [], investments: [], budgets: [], goals: [] };
    const current = normalized.finances[userId] || {};
    const withDefaults = { ...defaults, ...current };
    withDefaults.transactions = Array.isArray(withDefaults.transactions)
      ? withDefaults.transactions.map(normalizeTransaction)
      : [];
    withDefaults.investments = Array.isArray(withDefaults.investments)
      ? withDefaults.investments.map(normalizeInvestment)
      : [];
    normalized.finances[userId] = withDefaults;
  });

  if (!normalized.meta.cdiRate || Number.isNaN(Number(normalized.meta.cdiRate.value))) {
    normalized.meta.cdiRate = createDefaultMeta().cdiRate;
  }

  return normalized;
}

function ensureFinances(db, userId) {
  const defaults = { transactions: [], cards: [], investments: [], budgets: [], goals: [] };
  if (!db.finances[userId]) {
    db.finances[userId] = { ...defaults };
  } else {
    db.finances[userId] = { ...defaults, ...db.finances[userId] };
  }
  return db.finances[userId];
}

// Serializa operacoes de escrita para evitar que requests concorrentes sobrescrevam o estado
let dbQueue = Promise.resolve();
function runWithDbLock(task) {
  const run = dbQueue.then(async () => {
    const db = await loadDB();
    const result = await task(db);
    await saveDB(db);
    return result;
  });

  // Mantem a fila viva mesmo que uma execucao falhe
  dbQueue = run.catch((error) => {
    console.error("DB task failed:", error);
  });

  return run;
}

function updateUserFinances(userId, mutator) {
  return runWithDbLock(async (db) => {
    const finances = ensureFinances(db, userId);
    const result = await mutator(finances, db);
    db.finances[userId] = finances;
    return result;
  });
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
  const isSeed = String(current.source || "").toLowerCase() === "seed";
  const isStale = isSeed || ageDays >= CDI_MAX_AGE_DAYS;

  if (!force && !isStale) {
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

  const { question, dataContext, history } = req.body || {};
  if (!question && (!history || !Array.isArray(history) || history.length === 0)) {
    return res.status(400).json({ message: "Envie question ou history para gerar uma resposta" });
  }

  const safeDataContext = typeof dataContext === "string" ? dataContext : "";
  const normalizedHistory = Array.isArray(history)
    ? history
        .map((item) => {
          const content = typeof item.content === "string" ? item.content.trim() : "";
          if (!content) return null;
          const role = item.role === "assistant" || item.role === "ai" ? "assistant" : "user";
          return { role, content };
        })
        .filter(Boolean)
    : [];

  try {
    const messages = [
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
        role: "system",
        content: [
          "Contexto de dados autorizado (use somente se a pergunta pedir analise/calculo ou acao financeira; ignore em saudacoes ou conversas genericas):",
          safeDataContext || "(sem dados adicionais)",
        ].join("\n"),
      },
    ];

    if (normalizedHistory.length) {
      messages.push(...normalizedHistory);
    } else if (question && typeof question === "string") {
      messages.push({ role: "user", content: question });
    }

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
    });

    return res.json({ answer: completion.choices?.[0]?.message?.content || "" });
  } catch (error) {
    console.error("Erro ao responder (OpenAI):", error);
    return res.status(500).json({ message: "Nao foi possivel conectar ao assistente financeiro no momento." });
  }
});

app.post("/api/ai/import-transactions", authMiddleware, async (req, res) => {
  if (!openai) {
    return res.status(503).json({ message: "OPENAI_API_KEY nao configurado no servidor" });
  }

  const { fileName, fileBase64, instructions, textDescription } = req.body || {};
  const hasFile = Boolean(fileBase64);
  const hasTextDescription = typeof textDescription === "string" && textDescription.trim().length > 0;

  if (!hasFile && !hasTextDescription) {
    return res.status(400).json({ message: "Envie um arquivo ou um texto descrevendo as transacoes." });
  }

  let buffer = null;
  if (hasFile) {
    try {
      const cleaned = String(fileBase64).replace(/^data:.*;base64,/, "");
      buffer = Buffer.from(cleaned, "base64");
    } catch (error) {
      return res.status(400).json({ message: "Nao foi possivel ler o arquivo enviado" });
    }

    if (!buffer?.length) {
      return res.status(400).json({ message: "Arquivo vazio" });
    }
  }

  const extension = hasFile ? path.extname(String(fileName || "")).toLowerCase() : "";
  let extractedText = "";

  if (hasFile) {
    try {
      if (extension === ".pdf") {
        const parsed = await pdfParse(buffer);
        extractedText = parsed?.text || "";
      } else {
        extractedText = buffer.toString("utf-8");
      }
    } catch (error) {
      console.error("Erro ao extrair arquivo enviado:", error);
      extractedText = buffer.toString("utf-8");
    }
  }

  const manualText = hasTextDescription ? textDescription.toString().trim() : "";
  if (manualText) {
    extractedText = extractedText ? `${extractedText}\n\n${manualText}` : manualText;
  }

  const safeText = (extractedText || "").trim();
  if (!safeText) {
    return res.status(400).json({ message: "Nao foi possivel ler o conteudo enviado" });
  }

  const referenceDate = new Date().toISOString().split("T")[0];
  const truncatedText = safeText.slice(0, 15000);
  const instructionsText = (instructions || "").toString().trim() || "Sem instrucoes adicionais";
  const sourceLabel = hasFile && fileName ? fileName : "descricao-manual.txt";
  const detectionText = `${sourceLabel} ${instructionsText} ${safeText.slice(0, 600)}`.toLowerCase();
  const isCardInvoice = /fatura|cart[aã]o|cartao|credit card|invoice/.test(detectionText);
  const systemHint = isCardInvoice
    ? "Observacao do sistema: conteudo parece fatura/extrato de cartao; retorne apenas gastos do cartao, sem pagamentos ou creditos."
    : "";

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: AI_IMPORT_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Arquivo/Descricao: ${sourceLabel}`,
            `Data de referencia (para lancamentos sem data explicita): ${referenceDate}`,
            `Instrucoes do usuario: ${instructionsText}`,
            systemHint,
            "",
            "Conteudo lido (pode estar resumido):",
            truncatedText,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      parsed = {};
    }

    const rawTransactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
    const normalized = rawTransactions.flatMap((tx) => {
      const baseTx = isCardInvoice ? { ...tx, type: "EXPENSE", paymentMethod: "CARD", status: "PENDING" } : tx;
      return expandInstallmentsFromAi({ ...baseTx, date: baseTx.date || referenceDate }, referenceDate);
    });

    await updateUserFinances(req.userId, (finances) => {
      finances.transactions = [...normalized, ...finances.transactions];
    });

    return res.status(201).json({
      transactions: normalized,
      preview: truncatedText.slice(0, 800),
      usedInstructions: instructionsText,
    });
  } catch (error) {
    console.error("Erro ao importar transacoes via IA:", error);
    return res.status(500).json({ message: "Nao foi possivel processar o arquivo no momento." });
  }
});

app.post("/api/ai/transactions/manage", authMiddleware, async (req, res) => {
  const { deleteIds, updates, creates } = req.body || {};
  const result = await updateUserFinances(req.userId, (finances) => {
    let changed = false;

    if (Array.isArray(deleteIds) && deleteIds.length) {
      const uniqueIds = Array.from(new Set(deleteIds));
      finances.transactions = finances.transactions.filter((t) => !uniqueIds.includes(t.id));
      changed = true;
    }

    if (Array.isArray(updates)) {
      updates.forEach((tx) => {
        if (!tx?.id) return;
        const index = finances.transactions.findIndex((t) => t.id === tx.id);
        if (index !== -1) {
          finances.transactions[index] = normalizeTransaction({ ...finances.transactions[index], ...tx, id: tx.id });
          changed = true;
        }
      });
    }

    if (Array.isArray(creates)) {
      const newOnes = creates.map((tx) => normalizeTransaction(tx));
      finances.transactions = [...newOnes, ...finances.transactions];
      changed = true;
    }

    return { changed, transactions: finances.transactions };
  });

  return res.json({ transactions: result?.transactions || [] });
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
  db.finances[userId] = {
    transactions: [...demoTransactions],
    cards: [...demoCards],
    investments: [...demoInvestments],
    budgets: [...demoBudgets],
    goals: [...demoGoals],
  };
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

  const created = transactions.map(normalizeTransaction);
  await updateUserFinances(req.userId, (finances) => {
    finances.transactions = [...created, ...finances.transactions];
  });
  return res.status(201).json({ transactions: created });
});

app.delete("/api/transactions/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  await updateUserFinances(req.userId, (finances) => {
    finances.transactions = finances.transactions.filter((t) => t.id !== id);
  });
  return res.status(204).end();
});

app.post("/api/transactions/delete", authMiddleware, async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ message: "ids deve ser uma lista com ao menos um item" });
  }

  const uniqueIds = Array.from(new Set(ids.filter(Boolean).map(String)));
  await updateUserFinances(req.userId, (finances) => {
    finances.transactions = finances.transactions.filter((t) => !uniqueIds.includes(t.id));
  });

  return res.status(204).end();
});

app.post("/api/cards", authMiddleware, async (req, res) => {
  const card = normalizeCard(req.body || {});
  await updateUserFinances(req.userId, (finances) => {
    finances.cards = [...finances.cards, card];
  });
  return res.status(201).json({ card });
});

app.delete("/api/cards/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  await updateUserFinances(req.userId, (finances) => {
    finances.cards = finances.cards.filter((c) => c.id !== id);
  });
  return res.status(204).end();
});

app.post("/api/investments", authMiddleware, async (req, res) => {
  const investment = normalizeInvestment(req.body || {});
  await updateUserFinances(req.userId, (finances) => {
    finances.investments = [...finances.investments, investment];
  });
  return res.status(201).json({ investment });
});

app.put("/api/investments/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const result = await updateUserFinances(req.userId, (finances) => {
    const existingIndex = finances.investments.findIndex((i) => i.id === id);
    if (existingIndex === -1) {
      return { notFound: true };
    }

    const investment = normalizeInvestment({ ...finances.investments[existingIndex], ...req.body, id });
    finances.investments[existingIndex] = investment;
    return { investment };
  });

  if (result?.notFound) {
    return res.status(404).json({ message: "Investimento nao encontrado" });
  }

  return res.json({ investment: result?.investment });
});

app.delete("/api/investments/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  await updateUserFinances(req.userId, (finances) => {
    finances.investments = finances.investments.filter((i) => i.id !== id);
  });
  return res.status(204).end();
});

app.post("/api/budgets", authMiddleware, async (req, res) => {
  const budget = normalizeBudget(req.body || {});
  await updateUserFinances(req.userId, (finances) => {
    finances.budgets = [...finances.budgets, budget];
  });
  return res.status(201).json({ budget });
});

app.delete("/api/budgets/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  await updateUserFinances(req.userId, (finances) => {
    finances.budgets = finances.budgets.filter((b) => b.id !== id);
  });
  return res.status(204).end();
});

app.post("/api/goals", authMiddleware, async (req, res) => {
  const goal = normalizeGoal(req.body || {});
  await updateUserFinances(req.userId, (finances) => {
    finances.goals = [...finances.goals, goal];
  });
  return res.status(201).json({ goal });
});

app.put("/api/goals/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const result = await updateUserFinances(req.userId, (finances) => {
    const index = finances.goals.findIndex((g) => g.id === id);
    if (index === -1) {
      return { notFound: true };
    }
    const goal = normalizeGoal({ ...finances.goals[index], ...req.body, id });
    finances.goals[index] = goal;
    return { goal };
  });

  if (result?.notFound) {
    return res.status(404).json({ message: "Meta nao encontrada" });
  }

  return res.json({ goal: result?.goal });
});

app.delete("/api/goals/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  await updateUserFinances(req.userId, (finances) => {
    finances.goals = finances.goals.filter((g) => g.id !== id);
  });
  return res.status(204).end();
});

const DIST_DIR = path.join(__dirname, "dist");
const DIST_INDEX = path.join(DIST_DIR, "index.html");
if (existsSync(DIST_DIR) && existsSync(DIST_INDEX)) {
  app.use(express.static(DIST_DIR, { index: false }));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(DIST_INDEX));
}

function normalizeTransaction(input) {
  const status = normalizePaymentStatus(input.status, input);
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
    paymentMethod: normalizePaymentMethod(input.paymentMethod, input.cardId),
    status,
  };
}

function expandInstallmentsFromAi(tx, referenceDate) {
  const total = Number(tx.installmentTotal || tx.installmentsTotal || tx.installmentCurrent || 0);
  const installmentsPaid = Math.max(0, Number(tx.installmentsPaid || tx.paidInstallments || 0) || 0);
  const isInstallment = tx.isInstallment || total > 1;

  if (!isInstallment || total <= 1) {
    const baseDescription = shortenDescription(tx.description);
    return [normalizeTransaction({ ...tx, description: baseDescription, date: tx.date || referenceDate })];
  }

  const explicitInstallmentAmount = Number(
    tx.installmentAmount || tx.installmentValue || tx.parcela || tx.parcelValue || tx.perInstallmentAmount
  );
  const fullPurchaseAmount = Number(tx.totalAmount || tx.totalPurchase || tx.totalPurchaseAmount || tx.totalValue || tx.total);
  let perInstallmentAmount =
    Number.isFinite(explicitInstallmentAmount) && explicitInstallmentAmount > 0 ? explicitInstallmentAmount : Number(tx.amount || 0);

  if (Number.isFinite(fullPurchaseAmount) && fullPurchaseAmount > 0 && total > 0) {
    perInstallmentAmount = fullPurchaseAmount / total;
  }

  if (!Number.isFinite(perInstallmentAmount) || perInstallmentAmount <= 0) {
    perInstallmentAmount = Number(tx.amount || 0) / (total || 1) || 0;
  }

  const baseDateIso = tx.date || referenceDate;
  const baseDescription = shortenDescription(tx.description || "Parcelado");

  const items = [];
  for (let i = installmentsPaid; i < total; i += 1) {
    const installmentNumber = i + 1;
    const dueDate = new Date(baseDateIso);
    if (!Number.isNaN(dueDate.getTime())) {
      dueDate.setMonth(dueDate.getMonth() + (installmentNumber - 1));
    }
    items.push(
      normalizeTransaction({
        ...tx,
        amount: perInstallmentAmount,
        date: !Number.isNaN(new Date(baseDateIso).getTime()) ? dueDate.toISOString().split("T")[0] : referenceDate,
        description: `${baseDescription} (${installmentNumber}/${total})`,
        isInstallment: true,
        installmentCurrent: installmentNumber,
        installmentTotal: total,
        status: "PENDING",
      })
    );
  }

  return items;
}

function normalizePaymentMethod(value, cardId) {
  const upper = typeof value === "string" ? value.toUpperCase() : "";
  const normalized = upper.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");

  const mapped = {
    DINHEIRO: "CASH",
    CASH: "CASH",
    CARTAO: "CARD",
    CARTAOCREDITO: "CARD",
    CARTAODECREDITO: "CARD",
    DEBITO: "CARD",
    PIX: "PIX",
    TRANSFERENCIA: "PIX",
    TED: "PIX",
    DOC: "PIX",
  };

  if (PAYMENT_METHODS.includes(upper)) {
    return upper;
  }

  if (mapped[normalized]) {
    return mapped[normalized];
  }

  if (cardId) {
    return "CARD";
  }
  return "PIX";
}

function normalizePaymentStatus(value, txInput = {}) {
  const upper = typeof value === "string" ? value.toUpperCase() : "";
  if (PAYMENT_STATUS.includes(upper)) return upper;

  const isExpense = txInput.type !== "INCOME";
  const isCard = txInput.cardId || txInput.paymentMethod === "CARD";
  const isFuture = txInput.date && new Date(txInput.date) > new Date();

  if (isExpense && (isCard || isFuture || txInput.isInstallment)) {
    return "PENDING";
  }
  return "PAID";
}

function shortenDescription(text = "") {
  const cleaned = String(text || "").replace(/\s+/g, " ").replace(/[|_;]+/g, " ").trim();
  if (!cleaned) return "Transacao";
  const compact = cleaned.split(" ").slice(0, 8).join(" ");
  const trimmed = compact.length > 60 ? `${compact.slice(0, 57)}...` : compact;
  return trimmed;
}

function normalizeContribution(input = {}, fallbackDate) {
  const date = input.date || fallbackDate || new Date().toISOString().split("T")[0];
  return {
    id: input.id || randomUUID(),
    amount: Number(input.amount) || 0,
    date,
    note: input.note ? String(input.note) : undefined,
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
  const baseDate = input.startDate || input.date || new Date().toISOString().split("T")[0];
  const contributions = Array.isArray(input.contributions)
    ? input.contributions.map((c) => normalizeContribution(c, baseDate)).filter((c) => c.amount > 0)
    : [];

  if (!contributions.length && Number(input.amount)) {
    contributions.push(normalizeContribution({ amount: Number(input.amount), date: baseDate }, baseDate));
  }

  contributions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const totalAmount = contributions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const startDate = contributions.length ? contributions[0].date : baseDate;

  return {
    id: input.id || randomUUID(),
    name: input.name || "Investimento",
    amount: totalAmount,
    type: input.type || "CDB",
    percentageOfCDI: Number(input.percentageOfCDI) || 100,
    startDate,
    contributions,
  };
}

function normalizeBudget(input) {
  return {
    id: input.id || randomUUID(),
    category: input.category || "Geral",
    limit: Number(input.limit) || 0,
  };
}

function normalizeGoal(input) {
  return {
    id: input.id || randomUUID(),
    title: input.title || "Nova meta",
    target: Number(input.target) || 0,
    current: Number(input.current) || 0,
    deadline: input.deadline || "",
    category: input.category || "Geral",
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
