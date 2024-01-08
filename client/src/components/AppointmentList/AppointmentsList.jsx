import React, { useEffect, useState } from 'react';
import { Navigate } from "react-router-dom";
import axios from 'axios';
import "./AppointmentsList.scss"; 

const AppointmentsList = ({ token }) => {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [redirecting, setRedirecting] = useState({state:false, appointmentId:0});
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';

  const formatDate = (dateString) => {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
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

  const handleDelete = async (appointmentId) => {
    try {
      const response = await axios.delete(
        `${serverUrl}/api/appointments/${appointmentId}/delete`, 
        {
          headers: {
            Authorization: `Bearer ${token}`, // Assuming JWT token is used for authorization
          },
        }
      );
      fetchAppointments();
      // Call callback function to update the UI or parent component
      onAppointmentDeleted(appointmentId);
    } catch (error) {
      console.error('Error deleting appointment:', error.response.data);
      // Handle error
    }
  };

  const joinAppointment = (appointmentId) => {
    setRedirecting({state:true, appointmentId})
  };

  const handleAccept = async (appointmentId) => {
    try {
      const response = await axios.patch(
        `${serverUrl}/api/appointments/${appointmentId}/accept`, 
        {}, // You might need to send additional data in the body
        {
          headers: {
            Authorization: `Bearer ${token}`, // Assuming JWT token is used for authorization
          },
        }
      );
      fetchAppointments();
      // Handle additional logic for a successful accept, like updating UI
    } catch (error) {
      console.error('Error accepting appointment:', error.response.data);
      // Handle error
    }
  };

  const handleCancel = async (appointmentId) => {
    try {
      const response = await axios.patch(
        `${serverUrl}/api/appointments/${appointmentId}/cancel`, 
        {}, // You might need to send additional data in the body
        {
          headers: {
            Authorization: `Bearer ${token}`, // Assuming JWT token is used for authorization
          },
        }
      );
      fetchAppointments();
      // Handle additional logic for a successful cancel, like updating UI
    } catch (error) {
      console.error('Error canceling appointment:', error.response.data);
      // Handle error
    }
  };

  if (redirecting.state) {
    return(
      <Navigate to="/meeting" replace 
      state={{  appointmentId: redirecting.appointmentId, 
                type: 'service', 
                token: token }}/>
      ) ;
  }

  if (isLoading) {
    return <p className="loading">Loading appointments...</p>;
  }

  return (
    <div className="appointments-list">
      <h2 className="appointments-title">Your Appointments</h2>
      {appointments.length > 0 ? (
        <ul className="appointments-container">
          {appointments.map((appointment) => (
            <li key={appointment.appointmentId} className="appointment-item">
              <span className="appointment-details">
                Appointment: {formatDate(appointment.appointmentDateTime)} <br/> Client: {appointment.clientFirstName} {appointment.clientLastName}
              </span>
              <div className="appointment-actions">
                {/* Conditional rendering based on status */}
                {appointment.appointmentStatus == 'requested' && (
                  <>
                    <button className="btn btn-accept" onClick={() => handleAccept(appointment.appointmentId)}>Accept</button>
                    <button className="btn btn-cancel" onClick={() => handleCancel(appointment.appointmentId)}>Cancel</button>
                  </>
                )}

                {appointment.appointmentStatus == 'accepted' && (
                  <>
                    <button className="btn btn-join" onClick={() => joinAppointment(appointment.appointmentId)}>Join Session</button>
                    <button className="btn btn-cancel" onClick={() => handleCancel(appointment.appointmentId)}>Cancel</button>
                  </>
                )}

                {appointment.appointmentStatus == 'canceled' && (
                  <>
                    <button className="btn btn-cancel" onClick={() => handleDelete(appointment.appointmentId)}>Delete</button>
                    <button className="btn btn-accept" onClick={() => handleAccept(appointment.appointmentId)}>Accept</button>
                  </>
                )}
              </div>
            </li>
          ))}
    </ul>
  ) : (
    <p className="no-appointments">No appointments to show.</p>
  )}
</div>
  );
};

export default AppointmentsList;
