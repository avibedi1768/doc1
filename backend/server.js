const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const { GoogleGenAI } = require('@google/genai');
const nodemailer = require("nodemailer");

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
    // console.log('res:', result.text);

    res.json({ reply: result.text });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ reply: 'Something went wrong.' });
  }
});

// api for sending emails
app.post("/api/contact", async (req, res) => {
  const { firstName, lastName, email, phone, service, message, owner } = req.body;

  if (!firstName || !lastName || !email || !phone || !message) {
    return res.status(400).json({ success: false, error: "Missing fields" });
  }

  const fullMessage = `
Name: ${firstName} ${lastName}
Email: ${email}
Phone: ${phone}
Service Needed: ${service}
Message: ${message}
  `.trim();

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 1. Send email to owner
    await transporter.sendMail({
      from: `"Clinic Contact" <${process.env.EMAIL_USER}>`,
      to: owner,
      subject: "New Contact Form Submission",
      text: fullMessage,
    });

    // 2. Send confirmation email to user
    await transporter.sendMail({
      from: `"Clinic Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Thank you for contacting us!",
      text: `Hi ${firstName},\n\nThank you for reaching out. We have received your message and will get back to you shortly.\n\n- Clinic Team`,
    });

    res.status(200).json({ success: true, message: "Emails sent to owner and user" });
  } catch (error) {
    // console.error("Email sending error:", error);
    res.status(500).json({ success: false, error: "Failed to send emails" });
  }
});



app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
