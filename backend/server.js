const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const { GoogleGenAI } = require('@google/genai');

require('dotenv').config();

const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
// console.log('allowed:', allowedOrigins);


const app = express();
const PORT = 3000;

// Limit: 10 requests per IP per minute
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: { reply: "You've reached the limit. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Setup
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(bodyParser.json());

// Apply limiter only to /chat
app.use('/chat', limiter);

const apiKey = process.env.GEMINI_API
// console.log(apiKey);


// Gemini setup
const ai = new GoogleGenAI({
  apiKey: apiKey, // replace with your actual key
});

app.post('/chat', async (req, res) => {
  const { messages, websiteData, note } = req.body;

  const messageHistory = messages
    .map((msg) => `${msg.sender === "user" ? "User" : "Bot"}: ${msg.text}`)
    .join("\n");

  const contents = `
    You are a helpful assistant for a medical clinic. Reply in short, simple sentences. Use plain text only. 
    If you don't know something, reply with: Sorry, I'm not sure about that. Please contact the clinic.

    Clinic info:
    ${websiteData}

    ${note || "Use the following previous messages to understand context:"}

    ${messageHistory}
    `;

  // console.log('origin', req.headers.origin);


  console.log('inside server.js');


  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash', // or use 'gemini-2.0-pro' if you have access
      contents,
    });
    console.log('res:', result.text);

    res.json({ reply: result.text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: 'Something went wrong.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
