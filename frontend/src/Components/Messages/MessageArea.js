import React, { useLayoutEffect, useState, useEffect } from "react";
import { Box, Typography, Paper, IconButton, Menu, MenuItem } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";

const MessageArea = ({ messages, user, messagesEndRef, setMessages, setReplyTarget }) => {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuMsgId, setMenuMsgId] = useState(null);

  useLayoutEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [messages, messagesEndRef]);

  const handleOpenMenu = (e, msgId) => {
    setMenuAnchor(e.currentTarget);
    setMenuMsgId(msgId);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
    setMenuMsgId(null);
  };

  const handleDelete = (msg) => {
    const endpoint =
      msg.group
        ? `/api/message/group_messages/${msg.id}`
        : `/api/message/messages/${msg.id}`;

    if (!user) return;
    fetch(endpoint, { method: "DELETE", headers: { Authorization: `Bearer ${user.token}` } })
      .then(() => setMessages((prev) => prev.filter((m) => m.id !== msg.id)))
      .finally(handleCloseMenu);
  };

  /*
  useEffect(() => {
    if (messages.length > 0) {
      console.log("🕒 Raw timestamps received:", messages.map(m => m.timestamp));
    }
  }, [messages]);  
  */

  return (
    <Paper sx={{py: 2, height: "70vh", overflowY: "auto", mb: 1, backgroundColor: "#0b1220" }}>
      {messages.map((msg, i) => {
        const isFirst = i === 0;

        const isOwnMessage = msg.from === user.username;

        return (
          <Box
            key={i}
            sx={{
              mt: isFirst ? 3 : 0,
              display: "flex",
              justifyContent: isOwnMessage ? "flex-end" : "flex-start",
              mb: 1,
              
              "&:hover .msgActions": { opacity: 1 },
              gap: 0.5,
            }}
          >
            
            {isOwnMessage ? (
              <>
                
                <Box
                  sx={{
                    bgcolor: "primary.main",
                    color: "white",
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    maxWidth: "70%",
                  }}
                >
                  {msg.reply_to && (
                    <Box
                      sx={{
                        backgroundColor: "rgba(255,255,255,0.08)",
                        borderLeft: "3px solid #1976d2",
                        px: 1,
                        py: 0.5,
                        mb: 0.5,
                        borderRadius: 1,
                        fontSize: "0.8rem",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: "rgba(255,255,255,0.7)", fontStyle: msg.reply_to.content === "Message unavailable" ? "italic" : "normal" }}
                      >
                        {msg.reply_to.content === "Message unavailable"
                          ? "Message unavailable"
                          : <>Replying to <b>{msg.reply_to.from}</b>: {msg.reply_to.content}</>}
                      </Typography>
                    </Box>
                  )}

                  {msg.image_url && (
                    <Box
                      component="img"
                      src={msg.image_url}
                      alt="sent image"
                      sx={{
                        maxWidth: "100%",
                        maxHeight: 250,
                        borderRadius: 1,
                        mb: msg.content && msg.content !== "[image]" ? 1 : 0,
                        cursor: "pointer",
                        transition: "opacity 0.2s",
                        "&:hover": { opacity: 0.9 },
                      }}
                      onClick={() => window.open(msg.image_url, "_blank")}
                    />
                  )}

                  {(!msg.image_url || msg.content !== "[image]") && (
                    <Typography
                      variant="body2"
                      sx={{
                        wordBreak: "break-word",
                        overflowWrap: "break-word",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.content}
                    </Typography>
                  )}

                  <Typography
                    variant="caption"
                    sx={{ display: "block", textAlign: "right", opacity: 0.7 }}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </Typography>
                </Box>

                
                <Box className="msgActions" sx={{ opacity: 0, transition: "opacity .2s" }}>
                  <IconButton
                    size="small"
                    aria-label="mais opções"
                    onClick={(e) => handleOpenMenu(e, msg.id)}
                    sx={{ color: "rgba(255,255,255,.7)" }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Box>
              </>
            ) : (
              <>
                
                <Box className="msgActions" sx={{ opacity: 0, transition: "opacity .2s" }}>
                  
                </Box>

                
                <Box
                  sx={{
                    bgcolor: "grey.700",
                    color: "white",
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    maxWidth: "70%",
                    ml: 3
                  }}
                >
                  {msg.reply_to && (
                    <Box
                      sx={{
                        backgroundColor: "rgba(255,255,255,0.08)",
                        borderLeft: "3px solid #1976d2",
                        px: 1,
                        py: 0.5,
                        mb: 0.5,
                        borderRadius: 1,
                        fontSize: "0.8rem",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: "rgba(255,255,255,0.7)", fontStyle: msg.reply_to.content === "Message unavailable" ? "italic" : "normal" }}
                      >
                        {msg.reply_to.content === "Message unavailable"
                          ? "Message unavailable"
                          : <>Replying to <b>{msg.reply_to.from}</b>: {msg.reply_to.content}</>}
                      </Typography>
                    </Box>
                  )}

                  {msg.image_url && (
                    <Box
                      component="img"
                      src={msg.image_url}
                      alt="sent image"
                      sx={{
                        maxWidth: "100%",
                        maxHeight: 250,
                        borderRadius: 1,
                        mb: msg.content && msg.content !== "[image]" ? 1 : 0,
                        cursor: "pointer",
                        transition: "opacity 0.2s",
                        "&:hover": { opacity: 0.9 },
                      }}
                      onClick={() => window.open(msg.image_url, "_blank")}
                    />
                  )}
                  
                  {(!msg.image_url || msg.content !== "[image]") && (
                    <Typography
                      variant="body2"
                      sx={{
                        wordBreak: "break-word",
                        overflowWrap: "break-word",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      <b>{msg.from}: </b>
                      {msg.content}
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    sx={{ display: "block", textAlign: "right", opacity: 0.7 }}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString(navigator.language, {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    })}

                  </Typography>
                  
                </Box>

                <Box className="msgActions" sx={{ opacity: 0, transition: "opacity .2s" }}>
                    <IconButton
                      size="small"
                      aria-label="mais opções"
                      onClick={(e) => handleOpenMenu(e, msg.id)}
                      sx={{ color: "rgba(255,255,255,.7)" }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>
              </>
            )}

            
            <Menu
              open={Boolean(menuAnchor) && menuMsgId === msg.id}
              anchorEl={menuAnchor}
              onClose={handleCloseMenu}
              anchorOrigin={{ vertical: "top", horizontal: isOwnMessage ? "right" : "left" }}
              transformOrigin={{ vertical: "top", horizontal: isOwnMessage ? "left" : "right" }}
            >

              <MenuItem
                onClick={() => {
                  setReplyTarget(msg);  // 👈 store the message being replied to
                  handleCloseMenu();
                }}
              >
                Reply to message
              </MenuItem>

              <MenuItem
                onClick={() => handleDelete(msg)}
                sx={{ color: "error.main" }}
              >
                Delete Message
              </MenuItem>

            </Menu>
          </Box>
        );
      })}
      <div ref={messagesEndRef} />
    </Paper>
  );
};

export default MessageArea;
