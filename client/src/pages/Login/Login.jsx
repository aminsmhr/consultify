import './Login.scss';
import Input from "../../components/Input/Input";
import axios from "axios";
import { useState } from 'react';
import Signup from '../Signup/Signup';

function Login({ handleLogin }) {
    const [view, setView] = useState("login");
    const [error, setError] = useState(false);
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';

    if (view === "signup") {
        return <Signup changeToLogin={() => setView("login")}/>
    }

    const showSignUp = (e) => {
        e.preventDefault();
        setView("signup");
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(false);

        try {
            //send axios request to login user
            const response = await axios
                .post(`${serverUrl}/api/user/login`,
                {
                    email: e.target.email.value,
                    password: e.target.password.value
                }
            );

            handleLogin(response.data.token);

        } catch (error) {
            alert(error)
            console.log(error)
           setError(true);
        }
    }

    return (
        <main className="login-page">
            <form className="login" onSubmit={handleSubmit}>
                <h1 className="login__title">Log in</h1>

                <Input name="email" label="Email" />
                <Input type="password" name="password" label="Password" />

                <button className="login__button">
                    Log in
                </button>
                {error && <p>Error trying to login.</p>}
            </form>
            <p>
                Need an account? <a href="/signup" onClick={showSignUp}>Sign up</a>
            </p>
        </main>
    );
}

export default Login;
