import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  InputAdornment,
  IconButton,
  Paper,
  Container,
  Divider,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

function Register({ onRegister, onBack }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    try {
      const res = await fetch(`/api/user/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
  
      if (!res.ok) {
        const data = await res.json();
        if (typeof data.detail === "object" && data.detail.requirements) {
          setError(data.detail); // store the full object, not a string
        } else {
          setError({ message: data.detail || "Registration failed." });
        }
        return;
      }
            
  
      await res.json();
      onRegister();
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    }
  };
  

  const isDisabled = !username.trim() || !password.trim(); // igual ao comportamento do Login (desativado sem campos)

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
        <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 5 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography component="h1" variant="h5" fontWeight={700}>
              Register
            </Typography>
          </Box>

          <TextField
            fullWidth
            label="Username"
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            sx={{
              "& .MuiInputBase-root": { borderRadius: 2, height: 56 },
            }}
          />
          <TextField
            fullWidth
            type={showPassword ? "text" : "password"}
            label="Password"
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{
              "& .MuiInputBase-root": { borderRadius: 2, height: 56 },
            }}
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

          {error?.requirements && (
            <Box sx={{ mt: 1, color: "#ccc" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Invalid password:
              </Typography>
              {error.requirements.map((req, i) => (
                <Box
                  key={i}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    color: req.ok ? "#4caf50" : "#999",
                    fontSize: "0.9rem",
                    gap: 0.8,
                    pl: 1,
                  }}
                >
                  <Typography component="span" sx={{ fontWeight: req.ok ? 600 : 400 }}>
                    {req.ok ? "✔" : "✖"} {req.text}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          <Button
            fullWidth
            variant="contained"
            disabled={isDisabled}
            onClick={handleRegister}
            sx={{
              mt: 2,
              height: 56,
              borderRadius: 999,
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            REGISTER
          </Button>

          <Divider sx={{ my: 3 }} />

          <Button
            fullWidth
            variant="text"
            onClick={onBack}
            startIcon={<ArrowBackIosNewRoundedIcon fontSize="small" />}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              "& .MuiButton-startIcon": { mr: 1 },
            }}
          >
            Back to Login
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}

export default Register;
