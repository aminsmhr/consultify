import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import Header from "./components/Header/Header";
import VideoCall from "./components/VideoCall/VideoCall";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";

function App() {
  const [token, setToken] = useState(sessionStorage.getItem("token"));
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';

  const handleLogin = (token) => {
    sessionStorage.setItem("token", token);
    setToken(token);
  }

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    setToken(null);
  }

  if (!token) {
    return <Login handleLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <Header title="Consultify"/>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard token={token} handleLogout={handleLogout}/> } />
          <Route path="/appointment" element={<Dashboard token={token} handleLogout={handleLogout}/> } />
          <Route path="/meeting" element={<VideoCall serverUrlProp={serverUrl}/> } />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
