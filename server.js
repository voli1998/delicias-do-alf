import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import pool from "./db.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(bodyParser.json());

const SECRET_KEY = process.env.SECRET_KEY;

// =========================
// CRIAÇÃO DAS TABELAS
// =========================
async function criarTabelas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      role TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      mesa TEXT,
      itens JSONB,
      total REAL,
      tipo TEXT,
      status TEXT DEFAULT 'pendente'
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cupons (
      id SERIAL PRIMARY KEY,
      codigo TEXT UNIQUE,
      desconto REAL
    );
  `);
}
criarTabelas();

// =========================
// MIDDLEWARE DE AUTENTICAÇÃO
// =========================
function autenticar(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).send("Token obrigatório");

  jwt.verify(token.split(" ")[1], SECRET_KEY, (err, user) => {
    if (err) return res.status(403).send("Token inválido");
    req.user = user;
    next();
  });
}

// =========================
// LOGIN / USUÁRIOS
// =========================
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  try {
    const result = await pool.query(
      "SELECT * FROM usuarios WHERE email = $1 AND senha = $2",
      [email, senha]
    );

    if (result.rows.length === 0)
      return res.status(401).send("Credenciais inválidas");

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, {
      expiresIn: "8h",
    });

    res.json({ token, role: user.role, nome: user.nome });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/usuarios", async (req, res) => {
  const { nome, email, senha, role } = req.body;
  try {
    await pool.query(
      "INSERT INTO usuarios (nome, email, senha, role) VALUES ($1, $2, $3, $4)",
      [nome, email, senha, role || "cliente"]
    );
    res.status(201).json({ message: "Usuário cadastrado com sucesso" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.put("/usuarios/:id", autenticar, async (req, res) => {
  const { nome, email, senha, role } = req.body;
  try {
    await pool.query(
      "UPDATE usuarios SET nome=$1, email=$2, senha=$3, role=$4 WHERE id=$5",
      [nome, email, senha, role, req.params.id]
    );
    res.json({ message: "Usuário atualizado com sucesso" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// =========================
// CUPONS
// =========================
app.get("/cupons", async (req, res) => {
  const result = await pool.query("SELECT * FROM cupons");
  res.json(result.rows);
});

app.post("/cupons", autenticar, async (req, res) => {
  const { codigo, desconto } = req.body;
  if (!codigo || !desconto)
    return res.status(400).json({ message: "Código e desconto são obrigatórios" });

  await pool.query("INSERT INTO cupons (codigo, desconto) VALUES ($1, $2)", [
    codigo.toUpperCase(),
    desconto,
  ]);

  res.status(201).json({ message: "Cupom criado com sucesso" });
});

// =========================
// PEDIDOS
// =========================
app.post("/pedidos", autenticar, async (req, res) => {
  const { mesa, itens, total } = req.body;
  const tipo = req.user.role === "garcom" ? "garcom" : "cliente";
  const valorFinal = tipo === "garcom" ? 0 : total;

  await pool.query(
    "INSERT INTO pedidos (mesa, itens, total, tipo) VALUES ($1, $2, $3, $4)",
    [mesa, JSON.stringify(itens), valorFinal, tipo]
  );

  res.status(201).json({ message: "Pedido criado com sucesso" });
});

app.get("/pedidos", autenticar, async (req, res) => {
  if (!["admin", "garcom"].includes(req.user.role))
    return res.status(403).send("Acesso negado");

  const result = await pool.query("SELECT * FROM pedidos ORDER BY id DESC");
  res.json(result.rows);
});

app.put("/pedidos/:id/status", autenticar, async (req, res) => {
  const { status } = req.body;
  await pool.query("UPDATE pedidos SET status=$1 WHERE id=$2", [
    status,
    req.params.id,
  ]);
  res.json({ message: "Status atualizado" });
});

// =========================
// TESTE
// =========================
app.get("/", (req, res) => {
  res.send("🚀 API do Delícias do Alf rodando com sucesso!");
});

// =========================
// INICIAR SERVIDOR
// =========================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
