import { createContext } from "react";
import axios from 'axios';
import { useState, useEffect } from "react";
import { toast } from 'react-toastify';

export const AppContext = createContext();

const AppContextProvider = (props) => {
  const currencySymbol = '₹';
  const backendUrl = "https://doctor-appointment-booking-backend-g9i2.onrender.com";

  const [doctors, setDoctors] = useState([]);
  const [token, setToken] = useState(() => {
    const savedToken = localStorage.getItem('token');
    return savedToken || false;
  });

  const [userData, setUserData] = useState(false);

  // GET DOCTORS LIST
  const getDoctorsData = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/doctor/list');
      if (data.success) {
        setDoctors(data.doctors);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.log(error);
      toast.error(error.message);
    }
  };

  // LOAD USER PROFILE
  const loadUserProfileData = async (tok) => {
    try {
      const storedToken =
        tok ||
        localStorage.getItem("token");

      if (
        !storedToken ||
        storedToken === "null" ||
        storedToken === "undefined" ||
        storedToken.trim() === ""
      ) {
        console.log("No valid token, skipping profile fetch.");
        setUserData(false);
        return;
      }

      const { data } = await axios.get(
        backendUrl + "/api/user/get-profile",
        { headers: { token: storedToken } }
      );

      if (data.success) {
        setUserData(data.userData);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.log("Profile fetch error:", error.message);
      toast.error("Failed to load profile");
    }
  };

  // INITIAL DOCTOR FETCH
  useEffect(() => {
    getDoctorsData();
  }, []);

  // FIX: LOAD PROFILE WHEN TOKEN CHANGES
  useEffect(() => {
    if (!token) {
      console.log("No valid token, skipping profile fetch.");
      setUserData(false);
      return;
    }

    loadUserProfileData(token);
  }, [token]);

  // CONTEXT VALUE
  const value = {
    doctors,
    getDoctorsData,
    currencySymbol,
    token,
    setToken,
    backendUrl,
    userData,
    setUserData,
    loadUserProfileData,
  };

  return (
    <AppContext.Provider value={value}>
      {props.children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;
