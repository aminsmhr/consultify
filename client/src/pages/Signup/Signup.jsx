import "./Signup.scss";
import { useState } from "react";
import axios from "axios";
import Input from "../../components/Input/Input";

function Signup({ changeToLogin }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [role, setRole] = useState('client');
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log('check mark', event.target.role.checked);
    axios
      .post(`${serverUrl}/api/user/register`, {
        email: event.target.email.value,
        password: event.target.password.value,
        first_name: event.target.first_name.value,
        last_name: event.target.last_name.value,
        phone: event.target.phone.value,
        address: event.target.address.value,
        role: event.target.role.checked,
      })
      .then(() => {
        setSuccess(true);
        setError("");
        event.target.reset();
        changeToLogin();
      })
      .catch((error) => {
        setSuccess(false);
        setError(error.response.data);
      });
  };

  return (
    <main className="signup-page">
      <form className="signup" onSubmit={handleSubmit}>
        <h1 className="signup__title">Sign up</h1>

        <Input name="first_name" label="First name" />
        <Input name="last_name" label="Last name" />
        <Input name="phone" label="Phone" />
        <Input name="address" label="Address" />
        <Input name="role" label="consultant" type="checkbox" checked={role === 'consultant'} onChange={() => role === 'consultant' ? setRole('client') : setRole('consultant') }/>

        <Input name="email" label="Email" />
        <Input type="password" name="password" label="Password" />

        <button className="signup__button">Sign up</button>

        {success && <div className="signup__message">Signed up!</div>}
        {error && <div className="signup__message">{error}</div>}
      </form>

      <p>Already have an account?<a href="#" onClick={changeToLogin}>Log In</a></p>
    </main>
  );
}

export default Signup;
