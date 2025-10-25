import React from "react";
import Login from "./Login";
import Register from "./Register";

const AuthWrapper = ({ showRegister, setShowRegister, setUser }) => {
  if (showRegister) {
    return (
      <Register
        onRegister={() => setShowRegister(false)}  // volta ao login
        onBack={() => setShowRegister(false)}
      />
    );
  }

  return <Login onLogin={setUser} onGoRegister={() => setShowRegister(true)} />;
};

export default AuthWrapper;
