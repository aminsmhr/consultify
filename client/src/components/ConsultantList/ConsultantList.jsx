import axios from 'axios';
import React , {useEffect, useState} from 'react';
import { Navigate } from "react-router-dom";
import './ConsultantList.scss'; 

function ConsultantList({token, reload}) {
    const [isLoading, setIsLoading] = useState(true);
    const [appointments, setAppointments] = useState([]);
    const [redirecting, setRedirecting] = useState({state:false, appointmentId:0});
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';

    const formatDate = (dateString) => {
      const options = {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      return new Date(dateString).toLocaleDateString('en-US', options);
    };
    
    useEffect(()=>{
      setTimeout(async ()=> await fetchAppointments(), 3000);
    },[reload])

    const fetchAppointments = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(`${serverUrl}/api/appointments/list`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setAppointments(response.data);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching appointments:", error);
        setIsLoading(false);
      }
    };

      function formatStatusMessage(status) {
        switch (status) {
            case 'requested':
                return 'Pending approval';
            case 'canceled':
                return 'Canceled';
            case 'declined':
                return 'Declined by consultant';
            default:
                return 'Awaiting action'; 
        }
    }

      const joinAppointment = (appointmentId) => {
        setRedirecting({state:true, appointmentId})
      };
      
      if (redirecting.state) {
        return(
          <Navigate to="/meeting" replace 
          state={{  appointmentId: redirecting.appointmentId, 
                    type: 'client', 
                    token: token }}/>
          ) ;
      }
      if (isLoading) {
        return <p>Loading...</p>
      }

      return (
        <>
        <div className="consultant-list">
            <h2 className='make-appointment__title'>Appointment List</h2>
            <div className="grid-container">
                {appointments && appointments.length > 0 ? (
                    appointments.map((appointment, index) => (
                        <div key={appointment.appointmentId} className="striped-row">
                            <p title={formatDate(appointment.appointmentDateTime)} className='row-data'>
                                {appointment.consultantFirstName} {appointment.consultantLastName}
                            </p>
                            {/* Conditionally render the Join button or status message */}
                            {appointment.appointmentStatus == 'accepted' ? (
                                <button className="book-appointment" onClick={() => joinAppointment(appointment.appointmentId)}>
                                    Join
                                </button>
                            ) : (
                                <span className="status-message">
                                    {formatStatusMessage(appointment.appointmentStatus)}
                                </span>
                            )}
                        </div>
                    ))
                ) : (
                    <p className="no-appointments">No appointments to show.</p>
                )}
            </div>
        </div>
        </>
    );
}

export default ConsultantList;
