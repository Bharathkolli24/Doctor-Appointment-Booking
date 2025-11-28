// CLEAN DOC CHAT PAGE — FULLY WORKING INSTANT UPDATE + UNREAD

import { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
import { DoctorContext } from "../../context/DoctorContext";
import { io } from "socket.io-client";
import { assets } from "../../assets/assets";

const DocChatPage = () => {
  const { dToken, profileData } = useContext(DoctorContext);
  const doctorId = profileData?._id;
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const isLoading = !doctorId;

  // AUTO SCROLL
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  // FETCH PATIENTS
  const fetchPatients = async () => {
    try {
      const { data } = await axios.get(
        `${backendUrl}/api/messages/doctor/${doctorId}/patients`,
        { headers: { Authorization: `Bearer ${dToken}` } }
      );
      setPatients(data);
    } catch (err) {
      console.log("Fetch patients error:", err);
    }
  };

  // FETCH MESSAGES
  const fetchMessages = async (patientId) => {
    try {
      const { data } = await axios.get(
        `${backendUrl}/api/messages/${patientId}/${doctorId}`,
        { headers: { Authorization: `Bearer ${dToken}` } }
      );

      setMessages(data);

      // mark unread as read
      await axios.post(
        `${backendUrl}/api/messages/mark-read`,
        { userId: patientId, doctorId },
        { headers: { Authorization: `Bearer ${dToken}` } }
      );

      fetchPatients(); // update sidebar unread
    } catch (err) {
      console.log("fetchMessages error:", err);
    }
  };

  // SOCKET CONNECT
  useEffect(() => {
    if (!doctorId || !dToken) return;

    const socket = io(backendUrl, {
      auth: { token: dToken, role: "doctor" }
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      fetchPatients();
    
      // auto rejoin the correct room if doctor already has a chat open
      if (selectedPatient) {
        socket.emit("joinRoom", {
          userId: selectedPatient._id,
          doctorId,
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [doctorId, dToken]);

  // SOCKET RECEIVE
  useEffect(() => {
    if (!socketRef.current) return;

    const socket = socketRef.current;

    const onMessage = async (msg) => {
      const sender = msg.senderId?._id || msg.senderId;
      const receiver = msg.receiverId?._id || msg.receiverId;
      const openedChatId = selectedPatient?._id;

      // If doctor is currently viewing this patient's chat → append instantly
      if (
        openedChatId &&
        (String(sender) === String(openedChatId) ||
          String(receiver) === String(openedChatId))
      ) {
        setMessages((prev) => [...prev, msg]);

        await axios.post(
          `${backendUrl}/api/messages/mark-read`,
          { userId: openedChatId, doctorId },
          { headers: { Authorization: `Bearer ${dToken}` } }
        );
      }

      fetchPatients(); // update sidebar instantly
    };

    socket.on("receiveMessage", onMessage);

    return () => {
      socket.off("receiveMessage", onMessage);
    };
  }, [selectedPatient]);

  // SELECT PATIENT
  const handleSelectPatient = async (patient) => {
    setSelectedPatient(patient);
  
    // doctor joins correct socket room
    socketRef.current?.emit("joinRoom", {
      userId: patient._id,
      doctorId,
    });
  
    await fetchMessages(patient._id);
  };
  // SEND MESSAGE
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedPatient) return;

    try {
      const { data } = await axios.post(
        `${backendUrl}/api/messages/send`,
        {
          senderId: doctorId,
          senderModel: "doctor",
          receiverId: selectedPatient._id,
          receiverModel: "user",
          message: newMessage
        },
        { headers: { Authorization: `Bearer ${dToken}` } }
      );

      socketRef.current.emit("sendMessage", data);
      setNewMessage("");
    } catch (err) {
      console.log("Send message error:", err);
    }
  };

  return (
    <div className="flex h-[80vh] border rounded-lg shadow-md">

      {isLoading ? (
        <div className="flex items-center justify-center w-full text-gray-500">
          Loading chat...
        </div>
      ) : (
        <>
          {/* SIDEBAR */}
          <div className="w-80 border-r overflow-y-auto p-4 bg-gray-50">
            <h2 className="font-semibold text-xl mb-4">Chats</h2>

            {patients.length === 0 && (
              <p className="text-gray-500 text-center mt-10">No messages yet</p>
            )}

            {patients.map((p) => {
              const isActive =
                selectedPatient &&
                String(selectedPatient._id) === String(p._id);

              const hasUnread = p.unreadCount > 0;

              return (
                <div
                  key={p._id}
                  onClick={() => handleSelectPatient(p)}
                  className={`flex items-center gap-3 p-3 rounded-xl shadow-sm cursor-pointer
                    ${isActive ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-100"}
                  `}
                >
                  <img
                    className="w-12 h-12 rounded-full object-cover"
                    src={p.profilePic || assets.avatar}
                    alt=""
                  />

                  <div className="flex-1 overflow-hidden">
                    <p className={`font-semibold truncate ${isActive ? "text-white" : ""}`}>
                      {p.name}
                    </p>

                    <p
                      className={`text-sm truncate ${
                        hasUnread
                          ? "font-bold text-blue-700"
                          : "text-gray-500"
                      }`}
                    >
                      {hasUnread ? "New Message" : p.lastMessage || "Start chatting..."}
                    </p>
                  </div>

                  {hasUnread && !isActive && (
                    <div className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {p.unreadCount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* CHAT AREA */}
          <div className="flex-1 flex flex-col">
            {selectedPatient ? (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  {messages.map((msg) => {
                    const senderId = msg.senderId?._id || msg.senderId;
                    const mine = String(senderId) === String(doctorId);

                    return (
                      <div
                        key={msg._id}
                        className={`flex my-2 ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`px-4 py-2 max-w-[70%] ${
                            mine
                              ? "bg-blue-600 text-white rounded-tl-xl rounded-tr-xl rounded-bl-xl"
                              : "bg-gray-200 rounded-tl-xl rounded-tr-xl rounded-br-xl"
                          }`}
                        >
                          {msg.message}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-3 border-t flex">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 border rounded-l-lg p-2"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-blue-600 text-white px-4 rounded-r-lg"
                  >
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a patient to start chat
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DocChatPage;
