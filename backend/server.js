import express from 'express';
import http from 'http';
import { initSocket } from "./socket/socket.js";
import cors from 'cors';
import 'dotenv/config';
import connectDB from './config/mongodb.js';
import connectCloudinary from './config/cloudinary.js';
import adminRouter from './routes/adminRoute.js';
import doctorRouter from './routes/doctorRoute.js';
import userRouter from './routes/userRoute.js';
import messageRouter from './routes/messageRoute.js';
import nodemailer from 'nodemailer';

// App config
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

connectDB();
connectCloudinary();

// Middlewares
app.use(express.json());
app.use(cors());

// Load env
const FRONTEND_URL = process.env.FRONTEND_URL;
const DOCTOR_URL = process.env.DOCTOR_URL;

// --- Nodemailer transporter (uses env vars) ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for 587/STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 20000 // 20s
});

// Verify transporter at startup (temporary debug)
transporter.verify()
  .then(() => console.log('Transporter verified OK'))
  .catch(err => console.error('Transporter verify failed:', err && err.message, err && err.code));

// TEMP: Test route to verify email sending from deployed server.
// Use process.env.TEST_EMAIL or fallback to EMAIL_USER.
app.get('/test-email', async (req, res) => {
  try {
    const toEmail = process.env.TEST_EMAIL || process.env.EMAIL_USER;
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: toEmail,
      subject: 'Render - test email',
      text: 'If you get this, email sending works from the deployed server'
    });
    console.log('TEST EMAIL SENT INFO:', info);
    return res.json({ ok: true, info });
  } catch (err) {
    console.error('TEST-EMAIL ERROR:', err && err.stack || err);
    return res.status(500).json({ ok: false, error: err.message, stack: err.stack });
  }
});
// --- End nodemailer debug/test setup ---

// API endpoints
app.use('/api/admin', adminRouter);
app.use('/api/doctor', doctorRouter);
app.use('/api/user', userRouter);
app.use('/api/messages', messageRouter);

app.get('/', (_, res) => res.send('API WORKING'));

// Initialize sockets BEFORE listen is fine, after also works—doing before for clarity
initSocket(server, FRONTEND_URL, DOCTOR_URL);

server.listen(PORT, () =>
  console.log(`Server started at http://localhost:${PORT}`)
);
