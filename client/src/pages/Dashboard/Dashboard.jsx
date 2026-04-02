import "./Dashboard.scss";
import { useEffect, useRef, useState } from "react";
import MakeAppointment from "../../components/MakeAppointment/MakeAppointment";
import ConsultantList from "../../components/ConsultantList/ConsultantList";
import axios from "axios";
import AppointmentsList from "../../components/AppointmentList/AppointmentsList";
import { getServerUrl } from "../../lib/serverUrl";
import io from "socket.io-client";

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

    const applyAppointmentPresence = (appointment, seedOnly = false) => {
      const isClient = String(profile.type) === "1";
      const peerSocketId = isClient
        ? appointment.consultantSocketId
        : appointment.clientSocketId;
      const peerName = isClient
        ? `${appointment.consultantFirstName} ${appointment.consultantLastName}`
        : `${appointment.clientFirstName} ${appointment.clientLastName}`;
      const previous = previousAppointmentState.current[appointment.appointmentId];

      previousAppointmentState.current = {
        ...previousAppointmentState.current,
        [appointment.appointmentId]: {
          peerSocketId,
          appointmentStatus: appointment.appointmentStatus,
          peerName,
        },
      };

      setActiveJoinStates((current) => {
        const next = current.filter((notification) => notification.id !== `active-${appointment.appointmentId}`);
        if (appointment.appointmentStatus === "accepted" && peerSocketId) {
          next.unshift({
            id: `active-${appointment.appointmentId}`,
            message: `${peerName} is in appointment #${appointment.appointmentId} now.`,
          });
        }
        return next.slice(0, 5);
      });

      const peerJustJoined =
        !seedOnly &&
        appointment.appointmentStatus === "accepted" &&
        peerSocketId &&
        (!previous || !previous.peerSocketId);

      if (peerJustJoined) {
        playNotificationSound();
        setJoinNotifications((current) => {
          const notification = {
            id: `${appointment.appointmentId}-${peerSocketId}`,
            message: `${peerName} joined appointment #${appointment.appointmentId}.`,
          };
          const seen = new Set(current.map((item) => item.id));
          if (seen.has(notification.id)) {
            return current;
          }
          return [notification, ...current].slice(0, 5);
        });
      }
    };

    const seedAppointments = async () => {
      try {
        const { data } = await axios.get(`${serverUrl}/api/appointments/list`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (isCancelled) {
          return;
        }

        const seededState = {};
        data.forEach((appointment) => {
          applyAppointmentPresence(appointment, true);
          const isClient = String(profile.type) === "1";
          seededState[appointment.appointmentId] = {
            peerSocketId: isClient ? appointment.consultantSocketId : appointment.clientSocketId,
            appointmentStatus: appointment.appointmentStatus,
          };
        });
        previousAppointmentState.current = seededState;
      } catch (error) {
        console.error("Error checking joined appointments:", error);
      }
    };

    seedAppointments();
    const dashboardSocket = io(serverUrl, {
      auth: { token },
    });

    dashboardSocket.on("appointment:presence", (appointment) => {
      if (!isCancelled) {
        applyAppointmentPresence(appointment, false);
      }
    });

    return () => {
      isCancelled = true;
      dashboardSocket.disconnect();
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
      <section className="dashboard__hero">
        <p className="dashboard__eyebrow">Workspace overview</p>
        <h1 className="dashboard__title">
          {profile?.type === 1 ? "Plan your next appointment" : "Manage your live sessions"}
        </h1>
        <p className="dashboard__subtitle">
          {profile?.type === 1
            ? "Browse consultants, lock in a time, and jump into sessions from one calm workspace."
            : "Review appointment requests, stay on top of joins in real time, and keep every session moving."}
        </p>
      </section>
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
        <div className="profile__heading">
          <div>
            <p className="profile__eyebrow">Signed in as</p>
            <h2>{profile.first_name} {profile.last_name}</h2>
          </div>
          <button className="profile__logout" onClick={handleLogout}>Log out</button>
        </div>
        <div className="profile__meta">
          <article>
            <span>Role</span>
            <strong>{String(profile.type) === "1" ? "Client" : "Consultant"}</strong>
          </article>
          <article>
            <span>Email</span>
            <strong>{profile.email}</strong>
          </article>
          <article>
            <span>Phone</span>
            <strong>{profile.phone}</strong>
          </article>
          <article>
            <span>Address</span>
            <strong>{profile.address}</strong>
          </article>
        </div>
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
