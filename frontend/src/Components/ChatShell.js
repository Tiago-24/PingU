import React from "react";
import { Box } from "@mui/material";


export default function ChatShell({ topBar, left, right }) {
  const bgApp = "#0b1220";
  const bgSidebar = "#0f172a";
  const bgRight = "#0b1220";
  const borderColor = "rgba(255,255,255,0.08)";

  return (
    <Box
      sx={{
        height: "calc(100vh)",
        width: "calc(100vw)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        bgcolor: bgApp,
      }}
    >
      {/* Topbar */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: `1px solid ${borderColor}`,
          flexShrink: 0,
        }}
      >
        {topBar}
      </Box>

      {/* IDK */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          minHeight: 0, 
          overflow: "hidden"
        }}
      >
        {/* Sidebar */}
        <Box
          sx={{
            width: 360,
            minWidth: 320,
            maxWidth: 420,
            bgcolor: bgSidebar,
            color: "white",
            borderRight: `1px solid ${borderColor}`,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              p: 2,
              "&::-webkit-scrollbar": { width: 8 },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 8,
              },
              "&::-webkit-scrollbar-track": {
                backgroundColor: "transparent",
              },
            }}
          >
            {left}
          </Box>
        </Box>

        
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            bgcolor: bgRight,
            color: "white",
            overflow: "hidden",
          }}
        >
          {right}
        </Box>
      </Box>
    </Box>
  );
}
