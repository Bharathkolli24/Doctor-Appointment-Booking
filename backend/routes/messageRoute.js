import express from "express";
import { sendMessage,getMessages,getDoctorPatients,markAsRead } from "../controllers/messageController.js";

const messageRouter = express.Router();

messageRouter.post("/send", sendMessage);
messageRouter.get("/:userId/:doctorId", getMessages);
messageRouter.post("/mark-read", markAsRead);
messageRouter.get("/doctor/:doctorId/patients", getDoctorPatients);

export default messageRouter;
