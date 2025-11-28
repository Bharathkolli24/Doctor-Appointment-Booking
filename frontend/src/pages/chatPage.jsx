import { useEffect, useState, useContext, useRef } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { AppContext } from "../context/AppContext";

const ChatPage = ({ doctorId, userId }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const { token } = useContext(AppContext);
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const socketRef = useRef(null);

  // ---------------- SOCKET SETUP ----------------
  useEffect(() => {
    if (!token) {
      toast.warn("Please login to chat");
      navigate("/login");
      return;
    }

    if (!doctorId || !userId) return;

    const socket = io(backendUrl, { auth: { token, role: "user" } });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("joinRoom", { userId, doctorId });
    });

    socket.on("connect_error", (err) => {
      console.error("Socket error:", err);
    });

    return () => socket.disconnect();
  }, [token, doctorId, userId, backendUrl, navigate]);

  // ---------------- FETCH MESSAGES + LISTEN ----------------
  useEffect(() => {
    if (!socketRef.current || !userId || !doctorId) return;

    const fetchMessages = async () => {
      try {
        const { data } = await axios.get(
          `${backendUrl}/api/messages/${userId}/${doctorId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessages(data);
      } catch (err) {
        console.error("Fetch messages error:", err.message);
      }
    };

    fetchMessages();

    const onReceive = (msg) => {
      const sender = msg.senderId?._id || msg.senderId;
      const receiver = msg.receiverId?._id || msg.receiverId;

      if(
        (String(sender) === String(userId) && String(receiver) === String(doctorId)) ||
        (String(sender) === String(doctorId) && String(receiver) === String(userId))
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    };

    socketRef.current.on("receiveMessage", onReceive);
    return () => socketRef.current.off("receiveMessage", onReceive);
  }, [userId, doctorId, backendUrl, token]);

  // ---------------- SEND MESSAGE ----------------
  const sendMessage = async () => {
    if (!input.trim() || !socketRef.current) return;

    const msgData = {
      senderId: userId,
      receiverId: doctorId,
      senderModel: "user",
      receiverModel: "doctor",
      message: input,
    };

    try {
      const { data: savedMsg } = await axios.post(
        `${backendUrl}/api/messages/send`,
        msgData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      socketRef.current.emit("sendMessage", savedMsg);
      setInput("");
    } catch (err) {
      console.error("Send message error:", err.message);
      toast.error("Failed to send message");
    }
  };

  return (
    <div className="flex justify-center items-center h-[calc(100vh-100px)] p-4">
      <div className="flex flex-col w-full max-w-2xl h-full border rounded-lg shadow-lg bg-white">

        <div className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center mt-10">No messages yet</div>
        ) : (
          messages.map((m, i) => {
            const mine = String(m?.senderId?._id || m?.senderId) === String(userId);
          
            return (
              <div key={i} className={`flex my-2 ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`px-4 py-2 max-w-[70%] ${
                    mine
                      ? "bg-blue-600 text-white rounded-tl-xl rounded-tr-xl rounded-bl-xl"
                      : "bg-gray-200 text-black rounded-tl-xl rounded-tr-xl rounded-br-xl"
                  }`}
                >
                  {m.message}
                </div>
              </div>
            );
          })
        )}
        </div>

        <div className="flex border-t">
          <input
            className="border-0 p-2 flex-1 rounded-l-lg outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage} className="bg-blue-600 text-white px-4 rounded-r-lg">
            Send
          </button>
        </div>

      </div>
    </div>
  );
};

export default ChatPage;
