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
