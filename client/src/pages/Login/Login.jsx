import './Login.scss';
import Input from "../../components/Input/Input";
import axios from "axios";
import { useState } from 'react';
import Signup from '../Signup/Signup';
import { getServerUrl } from '../../lib/serverUrl';

function Login({ handleLogin }) {
    const [view, setView] = useState("login");
    const [error, setError] = useState(false);
    const serverUrl = getServerUrl();

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
            <section className="login-page__panel">
                <div className="login-page__intro">
                    <span className="login-page__eyebrow">Consultify platform</span>
                    <h1>Advisory sessions with a sharper interface.</h1>
                    <p>
                        Manage bookings, jump into calls, and keep both consultants and clients in sync
                        from one polished workspace.
                    </p>
                </div>
                <form className="login" onSubmit={handleSubmit}>
                    <h2 className="login__title">Welcome back</h2>
                    <p className="login__subtitle">Sign in to review your upcoming sessions.</p>

                    <Input name="email" label="Email" />
                    <Input type="password" name="password" label="Password" />

                    <button className="login__button">
                        Log in
                    </button>
                    {error && <p className="login__error">Error trying to login.</p>}
                    <p className="login__switch">
                        Need an account? <a href="/signup" onClick={showSignUp}>Sign up</a>
                    </p>
                </form>
            </section>
        </main>
    );
}

export default Login;
