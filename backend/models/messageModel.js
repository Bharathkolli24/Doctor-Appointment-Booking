import mongoose from "mongoose";
import "../models/userModel.js";
import "../models/doctorModel.js";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "senderModel",
      required: true,
    },

    senderModel: {
      type: String,
      required: true,
      enum: ["user", "doctor"],
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "receiverModel",
      required: true,
    },

    receiverModel: {
      type: String,
      required: true,
      enum: ["user", "doctor"],
    },

    message: {
      type: String,
      required: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
