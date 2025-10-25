import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;
const app = express();

// Configuração de middlewares
app.use(cors());
app.use(express.json());

// Configuração do banco PostgreSQL (Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Rota de teste
app.get("/", (req, res) => {
  res.send("🚀 API do App de Pedidos está rodando com sucesso!");
});

// ✅ Buscar produtos (exemplo público)
app.get("/produtos", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM produtos ORDER BY nome ASC");
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

// ✅ Adicionar produto (área do admin)
app.post("/produtos", async (req, res) => {
  const { nome, preco, descricao, imagem } = req.body;

  if (!nome || !preco) {
    return res.status(400).json({ error: "Nome e preço são obrigatórios" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO produtos (nome, preco, descricao, imagem) VALUES ($1, $2, $3, $4) RETURNING *",
      [nome, preco, descricao, imagem]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao adicionar produto:", error);
    res.status(500).json({ error: "Erro ao adicionar produto" });
  }
});

// ✅ Atualizar produto
app.put("/produtos/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, preco, descricao, imagem } = req.body;

  try {
    const result = await pool.query(
      "UPDATE produtos SET nome=$1, preco=$2, descricao=$3, imagem=$4 WHERE id=$5 RETURNING *",
      [nome, preco, descricao, imagem, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    res.status(500).json({ error: "Erro ao atualizar produto" });
  }
});

// ✅ Deletar produto
app.delete("/produtos/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("DELETE FROM produtos WHERE id=$1 RETURNING *", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }
    res.json({ message: "Produto removido com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar produto:", error);
    res.status(500).json({ error: "Erro ao deletar produto" });
  }
});

// ✅ Porta dinâmica para Render
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
