import "./Dashboard.scss";
import { useEffect, useRef, useState } from "react";
import MakeAppointment from "../../components/MakeAppointment/MakeAppointment";
import ConsultantList from "../../components/ConsultantList/ConsultantList";
import axios from "axios";
import AppointmentsList from "../../components/AppointmentList/AppointmentsList";
import { getServerUrl } from "../../lib/serverUrl";

function Dashboard({ token, handleLogout }) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [consultants, setConsultants] = useState([]);
  const [appointmentMade, setAppointmentMade] = useState(false);
  const [joinNotifications, setJoinNotifications] = useState([]);
  const [activeJoinStates, setActiveJoinStates] = useState([]);
  const previousAppointmentState = useRef({});

  const serverUrl = getServerUrl();

  useEffect(() => {
    (async ()=> await fetchConsultants())();
    fetchProfile();
  }, []);

  useEffect(() => {
    if (!profile) {
      return undefined;
    }

    let isCancelled = false;

    const pollAppointments = async (seedOnly = false) => {
      try {
        const { data } = await axios.get(`${serverUrl}/api/appointments/list`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (isCancelled) {
          return;
        }

        const isClient = String(profile.type) === "1";
        const nextState = {};
        const newlyJoined = [];
        const activeJoins = [];

        data.forEach((appointment) => {
          const peerSocketId = isClient
            ? appointment.consultantSocketId
            : appointment.clientSocketId;
          const peerName = isClient
            ? `${appointment.consultantFirstName} ${appointment.consultantLastName}`
            : `${appointment.clientFirstName} ${appointment.clientLastName}`;

          nextState[appointment.appointmentId] = {
            peerSocketId,
            appointmentStatus: appointment.appointmentStatus,
            peerName,
          };

          if (appointment.appointmentStatus === "accepted" && peerSocketId) {
            activeJoins.push({
              id: `active-${appointment.appointmentId}`,
              message: `${peerName} is in appointment #${appointment.appointmentId} now.`,
            });
          }

          const previous = previousAppointmentState.current[appointment.appointmentId];
          const peerJustJoined =
            !seedOnly &&
            appointment.appointmentStatus === "accepted" &&
            peerSocketId &&
            (!previous || !previous.peerSocketId);

          if (peerJustJoined) {
            newlyJoined.push({
              id: `${appointment.appointmentId}-${peerSocketId}`,
              message: `${peerName} joined appointment #${appointment.appointmentId}.`,
            });
          }
        });

        previousAppointmentState.current = nextState;
        setActiveJoinStates(activeJoins);

        if (newlyJoined.length > 0) {
          playNotificationSound();
          setJoinNotifications((current) => {
            const seen = new Set(current.map((notification) => notification.id));
            return [
              ...newlyJoined.filter((notification) => !seen.has(notification.id)),
              ...current,
            ].slice(0, 5);
          });
        }
      } catch (error) {
        console.error("Error checking joined appointments:", error);
      }
    };

    pollAppointments(true);
    const intervalId = setInterval(() => {
      pollAppointments(false);
    }, 10000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [profile, serverUrl, token]);

  useEffect(() => {
    if (joinNotifications.length === 0) {
      return undefined;
    }

    const timers = joinNotifications.map((notification) =>
      window.setTimeout(() => {
        setJoinNotifications((current) =>
          current.filter((item) => item.id !== notification.id)
        );
      }, 6000)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [joinNotifications]);

  const playNotificationSound = () => {
    if (typeof window === "undefined") {
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.18);
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.35);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.35);
    oscillator.onended = () => {
      audioContext.close();
    };
  };

  function eventAppointmentMade(e) {
    setAppointmentMade(!appointmentMade);
  }

  const fetchConsultants = async () => {
    try {
      const { data } = await axios.get(`${serverUrl}/api/user/consultants`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      setConsultants(data)
      setIsLoading(false);
      
    } catch (error) {
        console.log(error)
        setIsLoading(false);
    }
  }

  const fetchProfile = async () => {
    try {
      const { data: userProfile } = await axios.get(`${serverUrl}/api/user/current`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      setIsLoading(false);
      setProfile(userProfile);
    } catch (error) {
      handleLogout();
    }
  }

  if (isLoading) {
    return <p>Loading...</p>
  }

  return (
    <main className="dashboard">
      <h1 className="dashboard__title">Dashboard</h1>
      <div className="dashboard__toast-stack">
        {activeJoinStates.map((notification) => (
          <div key={notification.id} className="dashboard__toast dashboard__toast--active">
            <p>{notification.message}</p>
          </div>
        ))}
        {joinNotifications.map((notification) => (
          <div key={notification.id} className="dashboard__toast dashboard__toast--new">
            <p>{notification.message}</p>
          </div>
        ))}
      </div>
      {profile && <section className="profile">
        <p>Name: {profile.first_name} {profile.last_name}</p>
        <p>Address: {profile.address}</p>
        <p>Phone: {profile.phone}</p>
        <p>Email: {profile.email}</p>
        <a href="#" onClick={handleLogout}>Logout</a>
      </section>}
      {profile && (profile.type === 1) ?  <>
        <MakeAppointment consultants={consultants} token={token} onAppointmentMade={eventAppointmentMade} />  
        <ConsultantList token={token} reload={appointmentMade}/>
      </> :
      (<>
       <AppointmentsList token={token}/>
       </>
      )}
     </main>
  );
}

export default Dashboard;
