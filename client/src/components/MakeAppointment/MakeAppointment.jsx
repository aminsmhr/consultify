import React, { useState } from 'react';
import axios from 'axios';
import "./MakeAppointment.scss"; // Assuming this file exists and styles the form

const MakeAppointment = ({ consultants, token, onAppointmentMade }) => {
  const [selectedConsultant, setSelectedConsultant] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';

  const requestAppointment = async (data) => {
    try {
      setIsLoading(true);
      await axios.post(`${serverUrl}/api/user/appointments/book`, data, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      // setConsultants(data)
      setIsLoading(false);
      
    } catch (error) {
        console.log(error)
        setIsLoading(false);
     // handleLogout();
    }
  }
  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedConsultant || !dateTime) {
      alert("Please select a consultant and a date/time."); // Simple validation alert
      return;
    }

    requestAppointment({
      consultantId: selectedConsultant,
      dateTime: dateTime
    });
    onAppointmentMade({
      consultantId: selectedConsultant,
      dateTime: dateTime
    })
    setSelectedConsultant('');
    setDateTime('');
  };

  if (!consultants || isLoading)
    return (<p>Loading ...</p>)

  return (
    <div className="make-appointment">
      <h2 className="make-appointment__title">Make an Appointment</h2>
      <form onSubmit={handleSubmit} className="make-appointment__form">
        <label className="make-appointment__label">
          <p>Consultant:</p>
          <select 
            className="make-appointment__select"
            value={selectedConsultant} 
            onChange={(e) => setSelectedConsultant(e.target.value)}
          >
            <option value="">Select a Consultant</option>
            {consultants.map((consultant) => (
              <option key={consultant.id} value={consultant.id}>
                {consultant.first_name} {consultant.last_name}
              </option>
            ))}
          </select>
        </label>
        <label className="make-appointment__label">
          <p>Date & Time:</p>
          <input
            className="make-appointment__input"
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
          />
        </label>
        <button type="submit" className="make-appointment__button">Book Appointment</button>
      </form>
    </div>
  );
};

export default MakeAppointment;
