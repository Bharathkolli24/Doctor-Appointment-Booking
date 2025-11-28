import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "../context/AppContext";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();
  const { backendUrl, token, setToken } = useContext(AppContext);

  const [state, setState] = useState("Sign Up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpStep, setIsOtpStep] = useState(false);

  // -----------------------
  // HANDLE FORM SUBMIT
  // -----------------------
  const onSubmitHandler = async (event) => {
    event.preventDefault();

    try {
      // STEP 2 → OTP VERIFY
      if (isOtpStep) {
        const { data } = await axios.post(
          `${backendUrl}/api/user/verify-otp`,
          { email, otp }
        );

        if (data.success) {
          const safeToken = data.token ?? "";

          localStorage.setItem("token", safeToken);
          setToken(safeToken);

          toast.success("OTP verified successfully!");
          navigate("/"); // redirect now
        } else {
          toast.error("Invalid OTP");
        }
        return;
      }

      // STEP 1 → REGISTER
      if (state === "Sign Up") {
        const { data } = await axios.post(
          `${backendUrl}/api/user/register`,
          { name, email, password }
        );

        if (data.success) {
          await axios.post(`${backendUrl}/api/user/send-otp`, { email });    // LINE 54
          setIsOtpStep(true);
          toast.success("OTP sent to your email");
        } else {
          toast.error(data.message);
        }
      }

      // STEP 1 → LOGIN
      else {
        const { data } = await axios.post(
          `${backendUrl}/api/user/login`,
          { email, password }
        );

        if (data.success) {
          await axios.post(`${backendUrl}/api/user/send-otp`, { email });
          setIsOtpStep(true);
          toast.success("OTP sent to your email");
        } else {
          toast.error(data.message);
        }
      }
    } catch (error) {
      toast.error("Something went wrong");
    }
  };

  // -----------------------
  // AUTO REDIRECT IF LOGGED IN
  // -----------------------
  useEffect(() => {
    if (token && token !== "null" && token !== "undefined") {
      navigate("/");
    }
  }, [token, navigate]);

  return (
    <form onSubmit={onSubmitHandler} className="min-h-[80vh] flex items-center">
      <div className="flex flex-col gap-3 m-auto items-start p-8 min-w-[340px] sm:min-w-96 border rounded-xl text-zinc-600 text-sm shadow-lg">
        
        <p className="text-2xl font-semibold">
          {state === "Sign Up" ? "Create Account" : "Login"}
        </p>
        <p>Please {state === "Sign Up" ? "sign up" : "log in"} to book an appointment</p>

        {/* NAME */}
        {state === "Sign Up" && (
          <div className="w-full">
            <p>Full Name</p>
            <input
              className="border border-zinc-300 rounded w-full p-2 mt-1"
              type="text"
              onChange={(e) => setName(e.target.value)}
              value={name}
              required
              autoComplete="name"
            />
          </div>
        )}

        {/* EMAIL */}
        <div className="w-full">
          <p>Email</p>
          <input
            className="border border-zinc-300 rounded w-full p-2 mt-1"
            type="email"
            onChange={(e) => setEmail(e.target.value)}
            value={email}
            required
            autoComplete="email"
          />
        </div>

        {/* PASSWORD */}
        <div className="w-full">
          <p>Password</p>
          <input
            className="border border-zinc-300 rounded w-full p-2 mt-1"
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            value={password}
            required
            autoComplete={state === "Sign Up" ? "new-password" : "current-password"}
          />
        </div>

        {/* OTP INPUT */}
        {isOtpStep && (
          <div className="w-full">
            <p>Enter OTP</p>
            <input
              type="text"
              maxLength={6}
              className="border border-zinc-300 rounded w-full p-2 mt-1 text-center tracking-widest font-mono"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          </div>
        )}

        <button
          type="submit"
          className="bg-primary text-white w-full py-2 rounded-md text-base"
        >
          {state === "Sign Up"
            ? isOtpStep
              ? "Verify OTP"
              : "Create Account"
            : isOtpStep
            ? "Verify OTP"
            : "Login"}
        </button>

        {/* TOGGLE SIGNUP / LOGIN */}
        {state === "Sign Up" ? (
          <p>
            Already have an account?{" "}
            <span
              onClick={() => setState("Login")}
              className="text-primary underline cursor-pointer"
            >
              Login here
            </span>
          </p>
        ) : (
          <p>
            Create a new account?{" "}
            <span
              onClick={() => setState("Sign Up")}
              className="text-primary underline cursor-pointer"
            >
              Click here
            </span>
          </p>
        )}
      </div>
    </form>
  );
};

export default Login;
