import { createContext, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { io } from "socket.io-client";

export const DoctorContext = createContext();

const DoctorContextProvider = (props) => {
  const backendUrl = "https://doctor-appointment-booking-backend-3ekf.onrender.com/"

  const [dToken, setDToken] = useState(localStorage.getItem("dToken") || "");

  const [appointments, setAppointments] = useState([]);
  const [dashData, setDashData] = useState(null);
  const [profileData, setProfileData] = useState(null);

  // CHAT
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // ------------------ PROFILE --------------------
  const getProfileData = async () => {
    try {
      const { data } = await axios.get(backendUrl + "/api/doctor/profile", {
        headers: { Authorization: `Bearer ${dToken}` },
      });

      if (data.success) {
        setProfileData(data.profileData);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    if (dToken) getProfileData();
  }, [dToken]);

  // ------------------ DASHBOARD --------------------
  const getDashData = async () => {
    try {
      const { data } = await axios.get(backendUrl + "/api/doctor/dashboard", {
        headers: { Authorization: `Bearer ${dToken}` },
      });

      if (data.success) {
        setDashData(data.dashData);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ------------------ APPOINTMENTS --------------------
  const getAppointments = async () => {
    try {
      const { data } = await axios.get(
        backendUrl + "/api/doctor/appointments",
        { headers: { Authorization: `Bearer ${dToken}` } }
      );

      if (data.success) {
        setAppointments(data.appointments);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const completeAppointment = async (appointmentId) => {
    try {
      const { data } = await axios.post(
        backendUrl + "/api/doctor/complete-appointment",
        { appointmentId },
        { headers: { Authorization: `Bearer ${dToken}` } }
      );

      if (data.success) {
        toast.success(data.message);
        getAppointments();
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const cancelAppointment = async (appointmentId) => {
    try {
      const { data } = await axios.post(
        backendUrl + "/api/doctor/cancel-appointment",
        { appointmentId },
        { headers: { Authorization: `Bearer ${dToken}` } }
      );

      if (data.success) {
        toast.success(data.message);
        getAppointments();
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ------------------ SOCKET --------------------
  useEffect(() => {
    if (!dToken) return;

    const newSocket = io(backendUrl, {
      auth: { token: dToken, role: "doctor" },
    });

    setSocket(newSocket);

    newSocket.on("receiveMessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => newSocket.disconnect();
  }, [dToken]);

  // Send chat message
  const sendMessage = (content) => {
    if (!socket || !selectedUser) return;

    const msg = {
      to: selectedUser._id,
      content,
      sender: "doctor",
      timestamp: new Date(),
    };

    socket.emit("sendMessage", msg);
    setMessages((prev) => [...prev, msg]);
  };

  const fetchMessages = async (userId) => {
    try {
      const { data } = await axios.get(
        `${backendUrl}/api/messages/${userId}`,
        { headers: { Authorization: `Bearer ${dToken}` } }
      );

      if (data.success) {
        setMessages(data.messages);
        setSelectedUser(data.user);
      }
    } catch (err) {
      toast.error("Failed to fetch messages");
    }
  };

  return (
    <DoctorContext.Provider
      value={{
        dToken,
        setDToken,
        backendUrl,

        // dashboard
        dashData,
        setDashData,
        getDashData,

        // profile
        profileData,
        getProfileData,

        // appointments
        appointments,
        getAppointments,
        completeAppointment,
        cancelAppointment,

        // chat
        socket,
        messages,
        sendMessage,
        fetchMessages,
        selectedUser,
        setSelectedUser,
      }}
    >
      {props.children}
    </DoctorContext.Provider>
  );
};

export default DoctorContextProvider;
