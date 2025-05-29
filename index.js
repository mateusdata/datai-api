import express from "express";
import cors from "cors";
import axios from "axios";
import { pipeline } from "stream";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3001;
const PIPER_HOST = "http://localhost:5000"; // API do Piper

app.use(express.json());
app.use(cors());

// Inicializa cliente Google Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "AIzaSyAnyPWzIB2YJKK8Anex1aOCXndgmt5QwvQ" });

// Função para criar e enviar mensagens via Gemini Chat SDK
async function streamGeminiChat(model, messages, res) {
  // Extrai sistema e histórico de conversas
  const systemMsg = messages.find(m => m.role === 'system');
  const historyMsgs = messages.filter(m => m.role === 'user' || m.role === 'model');

  // Monta configuração
  const config = {
    systemInstruction: systemMsg ? systemMsg.content : "Você é a IA Data Matemática, sua professora super-humana de matemática.",
    temperature: 0.1,
    maxOutputTokens: 1024
  };

  // Cria chat
  const chat = ai.chats.create({
    model,
    history: historyMsgs.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
    config
  });

  // Inicia streaming da última mensagem do usuário
  const lastUser = historyMsgs[historyMsgs.length - 1];
  const stream = await chat.sendMessageStream({ message: lastUser.text || lastUser.content });

  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify({ message: { content: chunk.text } })}\n\n`);
  }
  res.end();
}

// Rota de chat com streaming
app.post("/api/chat", async (req, res) => {
  try {
    const { model, messages } = req.body;
    if (!model || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Model e array de mensagens são obrigatórios" });
    }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    await streamGeminiChat(model, messages, res);
  } catch (err) {
    console.error("Erro Gemini Chat:", err);
    if (!res.headersSent) res.status(500).json({ error: "Erro no Gemini Chat" });
  }
});

// Rota para TTS via Piper
app.post("/api/chat2", async (req, res) => {
  try {
    const { model, messages } = req.body;
    if (!model || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Model e array de mensagens são obrigatórios" });
    }

    // Extrai sistema e histórico
    const systemMsg = messages.find(m => m.role === 'system');
    const historyMsgs = messages.filter(m => m.role === 'user' || m.role === 'model');
    const config = {
      systemInstruction: systemMsg ? systemMsg.content : "Você é a IA Data Matemática, ...",
      temperature: 0.1
    };

    // Cria chat e envia última mensagem
    const chat = ai.chats.create({
      model,
      history: historyMsgs.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
      config
    });
    const lastUser = historyMsgs[historyMsgs.length - 1];
    const response = await chat.sendMessage({ message: lastUser.text || lastUser.content });
    const text = response.text;

    // Envia texto para Piper
    const piperRes = await axios.post(PIPER_HOST, text, {
      headers: { 'Content-Type': 'text/plain' },
      responseType: 'stream'
    });
    res.setHeader("Content-Type", "audio/wav");
    pipeline(piperRes.data, res, err => {
      if (err) console.error("Erro streaming áudio:", err);
    });
  } catch (err) {
    console.error("Erro Piper TTS:", err);
    res.status(500).json({ error: "Erro no TTS" });
  }
});

// Rota teste
app.get("/", (req, res) => res.json({ status: "ok" }));


app.get("/api/pipi", async (req, res) => {
  const { text } = req.query;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Parâmetro 'text' é obrigatório." });
  }

  try {
    const piperRes = await axios.post(PIPER_HOST, text, {
      headers: { "Content-Type": "text/plain" },
      responseType: "stream"
    });

    res.setHeader("Content-Type", "audio/wav");
    pipeline(piperRes.data, res, err => {
      if (err) console.error("Erro ao encaminhar stream do Piper:", err);
    });
  } catch (err) {
    console.error("Erro na rota /api/pipi:", err);
    res.status(500).json({ error: "Erro ao comunicar com o Piper." });
  }
});


app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
