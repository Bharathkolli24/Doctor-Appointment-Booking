import validator from 'validator'
import bcrypt from 'bcrypt'
import userModel from '../models/userModel.js'
import OTP from '../models/otpModel.js'
import nodemailer from 'nodemailer'
import jwt from 'jsonwebtoken'
import {v2 as cloudinary} from 'cloudinary'
import doctorModel from '../models/doctorModel.js'
import appointmentModel from '../models/appointmentModel.js'
import Razorpay from 'razorpay'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Function to generate and send OTP via email
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.create({ email, otp: otpCode });

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Embed logo as attachment
    const logoPath = path.join(__dirname, '../assets/logo.png');

    const htmlTemplate = `
    <html>
      <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 30px;">
        <div style="max-width: 500px; margin: auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="cid:doctorlogo" alt="Doctor Logo" width="120" style="margin-bottom: 10px;" />
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
      subject: 'Your OTP Code - Prescripto',
      html: htmlTemplate,
      attachments: [
        {
          filename: 'logo.png',
          path: logoPath,
          cid: 'doctorlogo' // same as cid in <img src>
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: 'OTP sent successfully' });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error });
  }
};

// OTP Verification Logic
const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  const record = await OTP.findOne({ email, otp });

  if (!record) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  await OTP.deleteOne({ email, otp });

  const user = await userModel.findOne({ email });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.status(200).json({ success: true, message: 'OTP verified', token });
};


// API to register user
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

    res.json({ success: true, token, userData: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


// API for user to login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });

    if (!user)
      return res.json({ success: false, message: "User doesn't exist" });

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "3h" });
      res.json({ success: true, token, userData: { id: user._id, name: user.name, email: user.email } });
    } else {
      res.json({ success: false, message: "Invalid Credentials" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


const getProfile = async (req, res) => {
  try {
    const userId = req.userId; // coming from authUser middleware

    const userData = await userModel.findById(userId).select('-password');

    if (!userData) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, userData });
  } catch (error) {
    console.log('GET PROFILE ERROR:', error.message);
    res.status(401).json({ success: false, message: 'Unauthorized' });
  }
};

// API to update user profile
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
      // Upload image to cloudinary
      const uploadResult = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" });
      const imageURL = uploadResult.secure_url;   // locally scoped to the if-block
      updateData.image = imageURL;
    }

    const updatedUser = await userModel.findByIdAndUpdate(req.userId, updateData, { new: true }).select('-password');

    res.json({ success: true, message: "Profile Updated", userData: updatedUser });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// API to book an appointment
const bookAppointment = async (req,res) => {
    try {
        const userId = req.userId;
        const {docId, slotDate, slotTime} = req.body
        const docData = await doctorModel.findById(docId).select('-password')
        
        if (!docData) {
            return res.json({ success: false, message: "Doctor not found" });
        }

        if (!docData.available) {
            return res.json({success:false,message:"Doctor not available"})
        }

        let slots_booked = docData.slots_booked   // we will get all slots_booked in this variable

        // checking for slots availability
        if (slots_booked[slotDate]) {
            if (slots_booked[slotDate].includes(slotTime)) {
                return res.json({success:false,message:"Slot not available"})
            } else {
                slots_booked[slotDate].push(slotTime)
            }
        } else {
            slots_booked[slotDate] = []
            slots_booked[slotDate].push(slotTime) 
        }

        const userData = await userModel.findById(userId).select('-password')

        delete docData.slots_booked

        const appointmentData  = {
            userId,
            docId,
            userData,
            docData,
            amount:docData.fees,
            slotTime,
            slotDate,
            date: Date.now()
        }

        const newAppointment = new appointmentModel(appointmentData)
        await newAppointment.save()

        //  save new slots data in to docData
        await doctorModel.findByIdAndUpdate(docId,{slots_booked})

        res.json({success:true,message:"Appointment Booked"})
    } catch (error) {
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

// APi to get user appointments for frontend my-appointments page
const listAppointments = async (req,res) => {
    try {
        const userId = req.userId
        const appointments = await appointmentModel.find({userId})

        res.json({success:true,appointments})

    } catch (error) {
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

// API to cancel Appointment
const cancelAppointment = async(req,res) => {
    try {
        const {appointmentId} = req.body
        const userId = req.userId

        const appointmentData = await appointmentModel.findById(appointmentId)

        // verify appointment made by the user 
        if (appointmentData.userId.toString() !== userId) {
            return res.json({success:false,message:"Unauthorized access"})
        }

        await appointmentModel.findByIdAndUpdate(appointmentData,{cancelled:true})

        // making the slot available when the appointment was cancelled
        const {docId,slotDate,slotTime} = appointmentData
        const doctorData = await doctorModel.findById(docId)
        let slots_booked = doctorData.slots_booked
        slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)

        await doctorModel.findByIdAndUpdate(docId, {slots_booked})

        res.json({success:true,message:"Appointment Cancelled"})

    } catch (error) {
        console.log(error)        
        res.json({success:false,message:error.message})
    }
}

const razorpayInstance = new Razorpay ({
    key_id:process.env.RAZORPAY_KEY_ID ,
    key_secret:process.env.RAZORPAY_KEY_SECRET
})

// API to make an payment of appointment using razorPay
const paymentRazorPay = async (req,res) => {

    try {
        const {appointmentId} = req.body 
        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({success:false,message:'Appointment is cancelled or not found'})
        }

        // Create options for razorpay Payment
        const options = {
            amount: appointmentData.amount * 100,    // *100 removes two decimal points
            currency : process.env.CURRENCY,
            receipt: appointmentId
        } 

        // creation of an order 
        const order = await razorpayInstance.orders.create(options)
        console.log("Order Response:", order);
        res.json({success:true,order})

    } catch (error) {
        console.log(error)        
        res.json({success:false,message:error.message})
    }
}

// API to verify payment of razor pay
const verifyRazorpay = async (req,res) =>{
    try {
        const { razorpay_order_id } = req.body
        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)
        if (orderInfo.status === 'paid') {
            await appointmentModel.findByIdAndUpdate(orderInfo.receipt,{payment:true}) 
            res.json({success:true,message:"Payment Successful"})
        } else {
            res.json({success:true,message:"Payment failed"})
        }
    } catch (error) {
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

export {sendOTP, verifyOTP, registerUser, loginUser, getProfile, updateProfile, bookAppointment, listAppointments, cancelAppointment, paymentRazorPay, verifyRazorpay}