import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import EditProfile from "./pages/EditProfile/EditProfile";
import Header from "./components/Header/Header";
import VideoCall from "./components/VideoCall/VideoCall";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { getServerUrl } from "./lib/serverUrl";

const PAGE_META = {
  "/dashboard": {
    title: "Consultify workspace",
    subtitle: "Appointments, conversations, and live sessions in one structured hub.",
  },
  "/appointment": {
    title: "Appointments",
    subtitle: "Review schedules, consultants, and active requests from one place.",
  },
  "/profile/edit": {
    title: "Profile settings",
    subtitle: "Keep your contact details, role information, and access credentials current.",
  },
  "/meeting": {
    title: "Live meeting",
    subtitle: "Join your session with a focused meeting stage and clear call controls.",
  },
};

function AuthenticatedApp({ token, profile, handleLogout, serverUrl, setProfile }) {
  const location = useLocation();

  const pageMeta = useMemo(
    () => PAGE_META[location.pathname] || PAGE_META["/dashboard"],
    [location.pathname]
  );

  return (
    <div className="app-shell">
      <Header profile={profile} onLogout={handleLogout} />
      <div className="app-shell__main">
        <div className="app-shell__topbar">
          <div>
            <p className="app-shell__eyebrow">Microsoft-style workspace</p>
            <h1>{pageMeta.title}</h1>
            <p className="app-shell__subtitle">{pageMeta.subtitle}</p>
          </div>
        </div>

        <div className="app-shell__content">
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
              element={(
                <EditProfile
                  token={token}
                  handleLogout={handleLogout}
                  onProfileUpdated={setProfile}
                />
              )}
            />
            <Route path="/meeting" element={<VideoCall serverUrlProp={serverUrl} />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(sessionStorage.getItem("token"));
  const [profile, setProfile] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(
    Boolean(sessionStorage.getItem("token"))
  );
  const serverUrl = getServerUrl();

  const handleLogin = (nextToken) => {
    sessionStorage.setItem("token", nextToken);
    setToken(nextToken);
    setIsBootstrapping(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    setToken(null);
    setProfile(null);
    setIsBootstrapping(false);
  };

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
      <AuthenticatedApp
        token={token}
        profile={profile}
        handleLogout={handleLogout}
        serverUrl={serverUrl}
        setProfile={setProfile}
      />
    </BrowserRouter>
  );
}

export default App;
