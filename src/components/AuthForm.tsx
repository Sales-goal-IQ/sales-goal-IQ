import { useState } from 'react';
import { supabase } from '../services/supabaseClient';

export default function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        // LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        setMessage("Logged in successfully!");
      } else {
        // SIGNUP
        const { error } = await supabase.auth.signUp({
          email,
          password
        });
        if (error) throw error;
        setMessage("Signup successful! You can now log in.");
        setIsLogin(true);
      }
    } catch (error: any) {
      setMessage(error.message);
    }

    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email) {
      setMessage("Enter an email first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) setMessage(error.message);
    else setMessage("Password reset email sent.");
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", textAlign: "center" }}>
      <h2>{isLogin ? "Login" : "Sign Up"}</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 12, fontSize: 16 }}
        />

        <input
          type="password"
          placeholder="Password (6+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 12, fontSize: 16 }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 12,
            fontSize: 16,
            background: "#0066ff",
            color: "#fff",
            border: "none",
            cursor: "pointer"
          }}
        >
          {loading ? "Please wait..." : isLogin ? "Login" : "Sign Up"}
        </button>
      </form>

      <div style={{ marginTop: 10 }}>
        <button
          onClick={() => setIsLogin(!isLogin)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#0066ff" }}
        >
          {isLogin ? "Create an account" : "Already have an account?"}
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <button
          onClick={handleResetPassword}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}
        >
          Forgot password?
        </button>
      </div>

      {message && (
        <p style={{ marginTop: 20, color: "red" }}>
          {message}
        </p>
      )}
    </div>
  );
}
