import { useParams } from "react-router-dom";
import { useContext } from "react";
import { AppContext } from "../context/AppContext";
import ChatPage from "./chatPage";

const ChatPageWrapper = () => {
  const { doctorId } = useParams();
  const { userData } = useContext(AppContext); // logged-in user

  return <ChatPage doctorId={doctorId} userId={userData?._id} />;
};

export default ChatPageWrapper;
