const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { pipeline } = require("stream");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;
const OLLAMA_HOST = "http://localhost:11434"; // API do Ollama
const PIPER_HOST = "http://localhost:5000";      // API do Piper

app.use(express.json());
app.use(cors());

// Rota para gerar resposta do Ollama
app.post("/api/chat", async (req, res) => {
  try {
    const { model, messages, stream = false } = req.body;
    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Model e um array de messages são obrigatórios" });
    }

    const data = {
      options: {
        temperature: 0.1,
        top_p: 0.1,
        num_predict: 9000000000000000,
        repeat_penalty: 1.5,
        mirostat: 2,
        stop: []
      }
    };

    const ollamaRequest = { model, messages, stream };

    if (stream) {
      const response = await axios.post(`${OLLAMA_HOST}/api/chat`, ollamaRequest, {
        responseType: "stream",
      });
      response.data.pipe(res);
    } else {
      const response = await axios.post(`${OLLAMA_HOST}/api/chat`, ollamaRequest);
      res.json(response.data);
    }
  } catch (error) {
    console.error("Erro ao chamar o Ollama:", error.message);
    res.status(500).json({ error: "Erro ao conectar com o Ollama" });
  }
});

// Rota para converter texto em áudio com Piper e retornar para o frontend
app.post("/api/chat2", async (req, res) => {
  const { model, messages } = req.body;

  // Validação dos parâmetros
  if (!model || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Model e um array de messages são obrigatórios" });
  }

  try {
    // 1️⃣ Enviar texto para o Ollama
    const ollamaResponse = await axios.post(`${OLLAMA_HOST}/api/chat`, { model, messages, stream: false });
    console.log("Resposta do Ollama:", ollamaResponse.data.message.content);
    const respostaOllama = ollamaResponse.data.message.content;

    // 2️⃣ Enviar o texto obtido para o Piper TTS para gerar o áudio
    const piperResponse = await axios.post(PIPER_HOST, respostaOllama, {
      headers: { 'Content-Type': 'text/plain' },
      responseType: 'stream'
    });
    console.log("Resposta do Piper recebida. Encaminhando áudio para o frontend...");

    // Configurar header para áudio WAV e encaminhar o stream do Piper para o cliente
    res.setHeader("Content-Type", "audio/wav");
    pipeline(piperResponse.data, res, (err) => {
      if (err) {
        console.error("Erro ao enviar áudio:", err.message);
        return res.status(500).end("Erro ao enviar áudio");
      }
    });
  } catch (error) {
    console.error("Erro ao enviar texto para o Ollama ou Piper:", error.message);
    return res.status(500).json({ error: "Erro ao processar a solicitação" });
  }
});

// Rota de teste
app.get("/", (req, res) => {
  res.json({ status: "ok" });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
