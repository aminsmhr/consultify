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

        if (newlyJoined.length > 0) {
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
      {joinNotifications.length > 0 ? (
        <section className="profile">
          <p><strong>Notifications</strong></p>
          {joinNotifications.map((notification) => (
            <p key={notification.id}>{notification.message}</p>
          ))}
        </section>
      ) : null}
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
