require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "https://portfolio-mi4lu9x1m-abhishekroshans-projects.vercel.app/",
  methods: ["POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

const requiredEnvVars = ["EMAIL", "PASSWORD", "RECEIVER_EMAIL"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`ERROR: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error("SMTP Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to take our messages");
  }
});

const rateLimit = {};
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; 
  const maxRequests = 5;

  if (!rateLimit[ip]) {
    rateLimit[ip] = { count: 1, startTime: now };
    return next();
  }

  if (now - rateLimit[ip].startTime > windowMs) {
    rateLimit[ip] = { count: 1, startTime: now };
    return next();
  }

  if (rateLimit[ip].count >= maxRequests) {
    const waitTime = Math.ceil((windowMs - (now - rateLimit[ip].startTime)) / 1000);
    return res.status(429).json({
      error: "Too many requests",
      message: `Please try again in ${waitTime} seconds`
    });
  }

  rateLimit[ip].count++;
  next();
});

app.post("/send", async (req, res) => {
  console.log("Incoming request body:", req.body); 
  const { name, email, message } = req.body;

  if (!message || message.trim() === "") {
    console.log("Validation failed: Empty message");
    return res.status(400).json({ 
      error: "Validation failed",
      message: "Message cannot be empty" 
    });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Invalid email format"
    });
  }

  const mailOptions = {
    from: `"Portfolio Contact" <${process.env.EMAIL}>`,
    to: process.env.RECEIVER_EMAIL,
    replyTo: email && email.trim() !== "" ? email : "anonymous@portfolio.com",
    subject: `New Message from ${name || "Anonymous"}`,
    text: `
Name: ${name || "Anonymous"}
Email: ${email || "Not Provided"}

Message:
${message}
    `,
    html: `
      <h3>New Contact Form Submission</h3>
      <p><strong>Name:</strong> ${name || "Anonymous"}</p>
      <p><strong>Email:</strong> ${email || "Not Provided"}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, "<br>")}</p>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    res.status(200).json({ 
      success: true,
      message: "Message sent successfully",
      messageId: info.messageId
    });
  } catch (error) {
    console.error("Email sending failed:", error);
    res.status(500).json({
      error: "Email sending failed",
      message: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: "Something went wrong"
  });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});