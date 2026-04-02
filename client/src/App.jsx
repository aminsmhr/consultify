import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import EditProfile from "./pages/EditProfile/EditProfile";
import Header from "./components/Header/Header";
import VideoCall from "./components/VideoCall/VideoCall";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { getServerUrl } from "./lib/serverUrl";

function App() {
  const [token, setToken] = useState(sessionStorage.getItem("token"));
  const [profile, setProfile] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(sessionStorage.getItem("token")));
  const serverUrl = getServerUrl();

  const handleLogin = (token) => {
    sessionStorage.setItem("token", token);
    setToken(token);
    setIsBootstrapping(true);
  }

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    setToken(null);
    setProfile(null);
    setIsBootstrapping(false);
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    const fetchProfile = async () => {
      try {
        const { data } = await axios.get(`${serverUrl}/api/user/current`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setProfile(data);
      } catch (error) {
        handleLogout();
      } finally {
        setIsBootstrapping(false);
      }
    };

    fetchProfile();
  }, [serverUrl, token]);

  if (!token) {
    return <Login handleLogin={handleLogin} />;
  }

  if (isBootstrapping && !profile) {
    return null;
  }

  return (
    <BrowserRouter>
      <div className="app">
        <Header title="Consultify" profile={profile} onLogout={handleLogout} />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route
            path="/dashboard"
            element={<Dashboard token={token} profile={profile} />}
          />
          <Route
            path="/appointment"
            element={<Dashboard token={token} profile={profile} />}
          />
          <Route
            path="/profile/edit"
            element={
              <EditProfile
                token={token}
                handleLogout={handleLogout}
                onProfileUpdated={setProfile}
              />
            }
          />
          <Route path="/meeting" element={<VideoCall serverUrlProp={serverUrl}/> } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
