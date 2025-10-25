import React, { useState } from "react";
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  Alert,
  Divider,
  CircularProgress,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

function Login({ onLogin, onGoRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      const res = await fetch(`/api/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setError("Invalid credentials");
        return;
      }

      const data = await res.json();

      console.log(`This is the res that i get from /login: ${data.access_token}`)

      // Também passas o user (que o backend já pode devolver dentro do login)
      onLogin({ token: data.access_token, id: data.user.id, username: data.user.username });
      
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = username.trim() !== "" && password !== "";
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && canSubmit && !loading) handleLogin();
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
        bgcolor: "grey.900",
      }}
    >
      <Container maxWidth="xs" disableGutters>
        <Paper sx={{ p: 4, borderRadius: 4 }}>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 2 }}>
            <Typography component="h1" variant="h5" fontWeight={700}>
              Login
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            autoFocus
            fullWidth
            label="Username"
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
          />

         <TextField
          fullWidth
          label="Password"
          type={showPassword ? "text" : "password"}
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((s) => !s)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />


          <Button
            fullWidth
            variant="contained"
            size="large"
            sx={{ mt: 2, borderRadius: 999, py: 1.25 }}
            onClick={handleLogin}
            disabled={!canSubmit || loading}
            endIcon={loading ? <CircularProgress size={18} /> : null}
          >
            {loading ? "Signing in..." : "Login"}
          </Button>

          <Divider sx={{ my: 2 }} />

          <Button fullWidth variant="text" onClick={onGoRegister} sx={{ textTransform: "none" }}>
            Don’t have an account? <Box component="span" sx={{ ml: 0.5, fontWeight: 700 }}>Register here</Box>
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}

export default Login;
