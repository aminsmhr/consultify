import "./Dashboard.scss";
import { useEffect, useState } from "react";
import MakeAppointment from "../../components/MakeAppointment/MakeAppointment";
import ConsultantList from "../../components/ConsultantList/ConsultantList";
import axios from "axios";
import AppointmentsList from "../../components/AppointmentList/AppointmentsList";

function Dashboard({ token, handleLogout }) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [consultants, setConsultants] = useState([]);
  const [appointmentMade, setAppointmentMade] = useState(false);

  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';

  useEffect(() => {
    (async ()=> await fetchConsultants())();
    fetchProfile();
  }, []);
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
