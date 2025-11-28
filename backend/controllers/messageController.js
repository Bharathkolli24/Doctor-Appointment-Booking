import Message from "../models/messageModel.js";
import { getIO } from "../socket/socket.js";
import mongoose from "mongoose";

// SEND MESSAGE
export const sendMessage = async (req, res) => {
  try {
    const { senderId, senderModel, receiverId, receiverModel, message } = req.body;

    const newMessage = await Message.create({
      senderId,
      senderModel,
      receiverId,
      receiverModel,
      message,
      isRead: false
    });

    await newMessage.populate([
      { path: "senderId", select: "name image" },
      { path: "receiverId", select: "name image" }
    ]);

    const io = getIO();
    const room = [senderId, receiverId].sort().join("_");
    io.to(room).emit("receiveMessage", newMessage);

    res.status(201).json(newMessage);
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET MESSAGES
export const getMessages = async (req, res) => {
  const { userId, doctorId } = req.params;

  try {
    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: doctorId },
        { senderId: doctorId, receiverId: userId }
      ]
    })
      .populate([
        { path: "senderId", select: "name image" },
        { path: "receiverId", select: "name image" }
      ])
      .sort({ createdAt: 1 });

    // FIX — mark unread as read using correct field
    await Message.updateMany(
      { senderId: userId, receiverId: doctorId, isRead: false },
      { $set: { isRead: true } }
    );

    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// MARK AS READ
export const markAsRead = async (req, res) => {
  const { userId, doctorId } = req.body;

  try {
    await Message.updateMany(
      { senderId: userId, receiverId: doctorId, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// GET DOCTOR PATIENTS WITH UNREAD + LAST MESSAGE
export const getDoctorPatients = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const list = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: new mongoose.Types.ObjectId(doctorId) },
            { receiverId: new mongoose.Types.ObjectId(doctorId) }
          ]
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", new mongoose.Types.ObjectId(doctorId)] },
              "$receiverId",
              "$senderId"
            ]
          },
          lastMessage: { $last: "$message" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiverId", new mongoose.Types.ObjectId(doctorId)] },
                    { $eq: ["$isRead", false] }   // FIXED
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: "$user._id",
          name: "$user.name",
          profilePic: "$user.image",
          lastMessage: 1,
          unreadCount: 1
        }
      }
    ]);

    res.json(list);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
