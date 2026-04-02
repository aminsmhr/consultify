import "./Signup.scss";
import { useState } from "react";
import axios from "axios";
import Input from "../../components/Input/Input";
import { getServerUrl } from "../../lib/serverUrl";

function Signup({ changeToLogin }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [role, setRole] = useState('client');
  const serverUrl = getServerUrl();

  const handleSubmit = (event) => {
    event.preventDefault();
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
      <section className="signup-page__panel">
        <div className="signup-page__intro">
          <span className="signup-page__eyebrow">Create your workspace</span>
          <h1>Bring consultants and clients into one polished session flow.</h1>
          <p>
            Launch a profile, pick a role, and start managing appointments with a sharper
            visual experience from day one.
          </p>
        </div>
        <form className="signup" onSubmit={handleSubmit}>
          <h2 className="signup__title">Create account</h2>
          <p className="signup__subtitle">Choose whether you are joining as a client or consultant.</p>

          <Input name="first_name" label="First name" />
          <Input name="last_name" label="Last name" />
          <Input name="phone" label="Phone" />
          <Input name="address" label="Address" />
          <Input name="role" label="consultant" type="checkbox" checked={role === 'consultant'} onChange={() => role === 'consultant' ? setRole('client') : setRole('consultant') }/>

          <Input name="email" label="Email" />
          <Input type="password" name="password" label="Password" />

          <button className="signup__button">Sign up</button>

          {success && <div className="signup__message signup__message--success">Signed up!</div>}
          {error && <div className="signup__message signup__message--error">{typeof error === "string" ? error : error?.error || "Signup failed."}</div>}
          <p className="signup__switch">Already have an account?<a href="#" onClick={changeToLogin}> Log In</a></p>
        </form>
      </section>
    </main>
  );
}

export default Signup;
