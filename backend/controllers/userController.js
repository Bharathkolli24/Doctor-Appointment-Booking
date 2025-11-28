import validator from "validator";
import bcrypt from "bcrypt";
import userModel from "../models/userModel.js";
import OTP from "../models/otpModel.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import Razorpay from "razorpay";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SEND OTP
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email" });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.create({ email, otp: otpCode });

    // Ensure env vars exist
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("Missing EMAIL_USER or EMAIL_PASS env vars");
      return res
        .status(500)
        .json({ success: false, message: "Email settings not configured" });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Optional: verify transporter connection (will throw on bad creds)
    try {
      await transporter.verify();
    } catch (verErr) {
      console.error("Nodemailer verify failed:", verErr);
      return res
        .status(500)
        .json({ success: false, message: "Email transporter verification failed" });
    }

    // Try to resolve local logo path safely; only attach if file exists
    let attachments = [];
    try {
      // Use path.resolve so it works on deployment platforms
      const logoPath = path.resolve("assets/logo.png");
      if (fs.existsSync(logoPath)) {
        attachments.push({
          filename: "logo.png",
          path: logoPath,
          cid: "doctorlogo", // same cid used in HTML
        });
      }
    } catch (fsErr) {
      // don't fail the entire request just because the logo isn't present
      console.warn("Logo attach skipped:", fsErr?.message || fsErr);
    }

    const htmlTemplate = `
    <html>
      <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 30px;">
        <div style="max-width: 500px; margin: auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 20px;">
            ${attachments.length ? '<img src="cid:doctorlogo" alt="Doctor Logo" width="120" style="margin-bottom: 10px;" />' : ""}
            <h2 style="color: #4f46e5;">Doctor Appointment Booking</h2>
          </div>
          <p style="font-size: 16px; color: #333;">Hello,</p>
          <p style="font-size: 16px; color: #333;">Your One-Time Password (OTP) is:</p>
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 5px; text-align: center; background: #f0f0f0; padding: 15px; border-radius: 10px; color: #111827;">
            ${otpCode}
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 20px;">This OTP is valid for 5 minutes. Please do not share it with anyone.</p>
          <p style="font-size: 14px; color: #666;">If you didn’t request this, you can safely ignore this email.</p>
          <div style="text-align: center; font-size: 12px; color: #aaa; margin-top: 30px;">&copy; 2025 Prescripto</div>
        </div>
      </body>
    </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code - Prescripto",
      html: htmlTemplate,
      attachments,
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("sendOTP error:", error);
    return res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

// VERIFY OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email & OTP required" });
    }

    const record = await OTP.findOne({ email, otp });
    if (!record) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    // Remove used OTP
    await OTP.deleteOne({ email, otp });

    const user = await userModel.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.status(200).json({ success: true, message: "OTP verified", token });
  } catch (error) {
    console.error("verifyOTP error:", error);
    return res.status(500).json({ success: false, message: "OTP verification failed" });
  }
};

// REGISTER USER
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.json({ success: false, message: "Missing Details" });

    if (!validator.isEmail(email))
      return res.json({ success: false, message: "Enter Valid Email" });

    if (password.length < 8)
      return res.json({ success: false, message: "Enter Strong Password" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new userModel({ name, email, password: hashedPassword });
    const user = await newUser.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "3h" });

    return res.json({ success: true, token, userData: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("registerUser error:", error);
    return res.json({ success: false, message: error.message });
  }
};

// LOGIN USER
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) return res.json({ success: false, message: "User doesn't exist" });

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "3h" });
      return res.json({ success: true, token, userData: { id: user._id, name: user.name, email: user.email } });
    } else {
      return res.json({ success: false, message: "Invalid Credentials" });
    }
  } catch (error) {
    console.error("loginUser error:", error);
    return res.json({ success: false, message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.userId; // coming from authUser middleware
    const userData = await userModel.findById(userId).select("-password");

    if (!userData) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, userData });
  } catch (error) {
    console.error("GET PROFILE ERROR:", error.message);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
};

// UPDATE PROFILE
const updateProfile = async (req, res) => {
  try {
    const { name, phone, address, dob, gender } = req.body;
    const imageFile = req.file;

    if (!name || !phone || !dob) {
      return res.json({ success: false, message: "Data Missing" });
    }

    const updateData = { name, phone, dob };
    if (address) updateData.address = JSON.parse(address);
    if (gender) updateData.gender = gender;

    if (imageFile) {
      const uploadResult = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" });
      const imageURL = uploadResult.secure_url;
      updateData.image = imageURL;
    }

    const updatedUser = await userModel.findByIdAndUpdate(req.userId, updateData, { new: true }).select("-password");

    return res.json({ success: true, message: "Profile Updated", userData: updatedUser });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.json({ success: false, message: error.message });
  }
};

// BOOK APPOINTMENT
const bookAppointment = async (req, res) => {
  try {
    const userId = req.userId;
    const { docId, slotDate, slotTime } = req.body;
    const docData = await doctorModel.findById(docId).select("-password");

    if (!docData) {
      return res.json({ success: false, message: "Doctor not found" });
    }

    if (!docData.available) {
      return res.json({ success: false, message: "Doctor not available" });
    }

    let slots_booked = docData.slots_booked || {};

    if (slots_booked[slotDate]) {
      if (slots_booked[slotDate].includes(slotTime)) {
        return res.json({ success: false, message: "Slot not available" });
      } else {
        slots_booked[slotDate].push(slotTime);
      }
    } else {
      slots_booked[slotDate] = [];
      slots_booked[slotDate].push(slotTime);
    }

    const userData = await userModel.findById(userId).select("-password");

    delete docData.slots_booked;

    const appointmentData = {
      userId,
      docId,
      userData,
      docData,
      amount: docData.fees,
      slotTime,
      slotDate,
      date: Date.now(),
    };

    const newAppointment = new appointmentModel(appointmentData);
    await newAppointment.save();

    await doctorModel.findByIdAndUpdate(docId, { slots_booked });

    return res.json({ success: true, message: "Appointment Booked" });
  } catch (error) {
    console.error("bookAppointment error:", error);
    return res.json({ success: false, message: error.message });
  }
};

// LIST APPOINTMENTS
const listAppointments = async (req, res) => {
  try {
    const userId = req.userId;
    const appointments = await appointmentModel.find({ userId });

    return res.json({ success: true, appointments });
  } catch (error) {
    console.error("listAppointments error:", error);
    return res.json({ success: false, message: error.message });
  }
};

// CANCEL APPOINTMENT
const cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const userId = req.userId;

    const appointmentData = await appointmentModel.findById(appointmentId);

    if (!appointmentData) {
      return res.json({ success: false, message: "Appointment not found" });
    }

    if (appointmentData.userId.toString() !== userId) {
      return res.json({ success: false, message: "Unauthorized access" });
    }

    await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true });

    const { docId, slotDate, slotTime } = appointmentData;
    const doctorData = await doctorModel.findById(docId);
    let slots_booked = doctorData.slots_booked || {};
    slots_booked[slotDate] = (slots_booked[slotDate] || []).filter((e) => e !== slotTime);

    await doctorModel.findByIdAndUpdate(docId, { slots_booked });

    return res.json({ success: true, message: "Appointment Cancelled" });
  } catch (error) {
    console.error("cancelAppointment error:", error);
    return res.json({ success: false, message: error.message });
  }
};

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// PAYMENT (RAZORPAY)
const paymentRazorPay = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const appointmentData = await appointmentModel.findById(appointmentId);

    if (!appointmentData || appointmentData.cancelled) {
      return res.json({ success: false, message: "Appointment is cancelled or not found" });
    }

    const options = {
      amount: appointmentData.amount * 100,
      currency: process.env.CURRENCY || "INR",
      receipt: appointmentId,
    };

    const order = await razorpayInstance.orders.create(options);
    console.log("Order Response:", order);
    return res.json({ success: true, order });
  } catch (error) {
    console.error("paymentRazorPay error:", error);
    return res.json({ success: false, message: error.message });
  }
};

const verifyRazorpay = async (req, res) => {
  try {
    const { razorpay_order_id } = req.body;
    const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);
    if (orderInfo.status === "paid") {
      await appointmentModel.findByIdAndUpdate(orderInfo.receipt, { payment: true });
      return res.json({ success: true, message: "Payment Successful" });
    } else {
      return res.json({ success: true, message: "Payment failed" });
    }
  } catch (error) {
    console.error("verifyRazorpay error:", error);
    return res.json({ success: false, message: error.message });
  }
};

export {
  sendOTP,
  verifyOTP,
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  bookAppointment,
  listAppointments,
  cancelAppointment,
  paymentRazorPay,
  verifyRazorpay,
};
