import React, { useState, useEffect } from "react";
import { Box, TextField, Button, IconButton, Typography } from "@mui/material";
import InsertEmoticonIcon from "@mui/icons-material/InsertEmoticon";
import Picker from "emoji-picker-react";
import "./InputArea.css";

import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";

const InputArea = ({
  input,
  setInput,
  socket,
  chatWith,
  chatGroup,
  user,
  setLastMessages,
  replyTarget,
  setReplyTarget, // 👈 added
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  const isUnknownUser =
  chatWith?.username === "Unknown User" ||
  chatWith?.username?.startsWith("UnknownUser_");



  const handleUpload = async (event) => {

    const file = event.target.files[0];
    if (!file) return;
  
    const formData = new FormData();
    formData.append("file", file);
  
    try {
      const res = await fetch(`/api/message/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
  
      // after upload success → send message through WS
      const msg = {
        content: "[image]",
        image_url: data.url,
        timestamp: new Date().toISOString(),
      };
  
      if (chatWith) {
        msg.type = "direct";
        msg.to = chatWith.id;
      } else if (chatGroup) {
        msg.type = "group";
        msg.group = chatGroup.id;
      } else {
        return;
      }
  
      socket.send(JSON.stringify(msg));
  
    } catch (err) {
      console.error("Upload error:", err);
      alert("❌ Failed to upload image");
    } finally {
      // reset the file input so it can re-trigger later
      event.target.value = "";
    }
  };

  useEffect(() => {
    if (!socket) return;
    const handleMsg = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "typing" && data.from_user_id !== user.id) {
        if (chatWith && data.from_username === chatWith.username) {
          setTypingUsers([data.from_username]);
        }
      }
      
      else if (data.type === "stop_typing") {
        if (chatWith && data.from_user_id !== user.id) {
          setTypingUsers([]);
        }
      }
      
      else if (data.type === "group_typing" && data.from_user_id !== user.id) {
        if (chatGroup && data.group_id === chatGroup.id) {
          setTypingUsers((prev) => {
            if (prev.includes(data.from_username)) return prev;
            return [...prev, data.from_username];
          });
        }
      }
      
      else if (data.type === "group_stop_typing") {
        if (chatGroup && data.group_id === chatGroup.id) {
          setTypingUsers((prev) =>
            prev.filter((name) => name !== data.from_username)
          );
        }
      }         
    };
    socket.addEventListener("message", handleMsg);
    return () => socket.removeEventListener("message", handleMsg);
  }, [socket]);  

  

  const handleTyping = (e) => {
    const value = e.target.value;
    setInput(value);
  
    if (!socket) return;
  
    const isGroup = !!chatGroup;
    const msg = {
      type: isGroup ? "group_typing" : "typing",
    };
  
    if (isGroup) {
      msg.group = chatGroup.id;
    } else if (chatWith) {
      msg.to = chatWith.id;
    } else {
      return;
    }
  
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  
    if (typingTimeout) clearTimeout(typingTimeout);
  
    const timeout = setTimeout(() => {
      console.log("🛑 sending stop_typing event");
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: isGroup ? "group_stop_typing" : "stop_typing",
            ...(isGroup ? { group: chatGroup.id } : { to: chatWith.id }),
          })
        );
      }
    }, 1000);
  
    setTypingTimeout(timeout);
  };
  


  const onEmojiClick = (emojiObject) => {
    setInput((prev) => prev + emojiObject.emoji);
  };

  const sendMessage = () => {
    if (!socket || input.trim() === "") return;

    // --- base message ---
    let msg = {
      content: input,
      timestamp: new Date().toISOString(),
    };

    if (chatWith) {
      msg.type = "direct";
      msg.to = chatWith.id;
    } else if (chatGroup) {
      msg.type = "group";
      msg.group = chatGroup.id;
    }

    // --- include reply info if any ---
    console.log("are we replyling?", replyTarget)
    if (replyTarget) {
      msg.reply_to = {
        id: replyTarget.id,
        from: replyTarget.from,
        content: replyTarget.content,
      };
    }

    // --- send message ---
    socket.send(JSON.stringify(msg));

    // --- update last message preview ---
    if (chatWith) {
      setLastMessages((prev) => ({
        ...prev,
        [chatWith.id]: { text: input, time: new Date().toISOString() },
      }));
    } else if (chatGroup) {
      setLastMessages((prev) => ({
        ...prev,
        [`group:${chatGroup.id}`]: {
          text: `${user.username}: ${input}`,
          time: new Date().toISOString(),
        },
      }));
    }

    // --- reset ---
    setInput("");
    setShowEmojiPicker(false);
    setReplyTarget(null); // clear reply after send ✅
  };

  return (
    <>
      {/* 🧩 Reply Preview */}
      {replyTarget && (
        <Box
          sx={{
            bgcolor: "rgba(25,118,210,0.15)",
            borderLeft: "3px solid #1976d2",
            borderRadius: 1,
            px: 1.5,
            py: 1,
            mb: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="caption" color="primary">
              Replying to {replyTarget.from}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "rgba(255,255,255,0.9)",
                maxWidth: "250px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {replyTarget.content}
            </Typography>
          </Box>

          <IconButton
            size="small"
            onClick={() => setReplyTarget(null)}
            sx={{ color: "rgba(255,255,255,0.7)" }}
          >
            ✕
          </IconButton>
        </Box>
      )}

      {typingUsers && typingUsers.length > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            color: "#aaa",
            fontStyle: "italic",
            fontSize: "0.9rem",
            position: "relative",
            top: -6,
            left: 8,
            height: 24,
            mb: 0.5,
            transition: "all 0.2s ease-in-out",
          }}
        >
          {typingUsers.join(", ")}{" "}
          {typingUsers.length === 1 ? "is typing" : "are typing"}
          <Box sx={{ display: "flex", ml: 0.5 }}>
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </Box>
        </Box>
      )}


      {/* 🧠 Input / Emoji / Send */}
      <Box
        sx={{
          flexShrink: 0,
          bgcolor: "#0e1628",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          p: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
          position: "relative",
        }}
      >
        {/* Upload Image Button */}
        <IconButton
          component="label"
          sx={{
            ml: 0.5,
            color: "rgba(255,255,255,0.75)",
            "&:hover": { color: "#06b6d4", bgcolor: "transparent" },
          }}
        >
          <AddPhotoAlternateRoundedIcon />
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={handleUpload}
          />
        </IconButton>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <Box
            sx={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              zIndex: 10,
              mb: 1,
            }}
          >
            <Picker onEmojiClick={onEmojiClick} theme="dark" />
          </Box>
        )}

        {/* Emoji Button */}
        <IconButton
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          sx={{
            ml: 0.5,
            color: "rgba(255,255,255,0.75)",
            "&:hover": { color: "#06b6d4", bgcolor: "transparent" },
          }}
        >
          <InsertEmoticonIcon />
        </IconButton>

        {/* Input */}
        <TextField
          fullWidth
          disabled={isUnknownUser}
          placeholder={
            isUnknownUser
              ? "This user no longer exists."
              : "Type a message..."
          }
          value={input}
          onChange={handleTyping}
          onKeyDown={(e) => e.key === "Enter" && !isUnknownUser && sendMessage()}
          sx={{
            "& .MuiInputBase-root": {
              bgcolor: isUnknownUser ? "#1b1b1b" : "#101a2f",
              color: isUnknownUser ? "rgba(255,255,255,0.5)" : "white",
              borderRadius: 9999,
              px: 2,
              height: 48,
            },
            "& fieldset": { border: "none" },
            "& input::placeholder": {
              color: isUnknownUser
                ? "rgba(255,255,255,0.4)"
                : "rgba(255,255,255,0.65)",
              fontStyle: isUnknownUser ? "italic" : "normal",
            },
          }}
        />


        {/* Send Button */}
        <Button
          variant="contained"
          onClick={!isUnknownUser ? sendMessage : undefined}
          disabled={isUnknownUser}
          sx={{
            borderRadius: 9999,
            px: 3,
            height: 48,
            fontWeight: 700,
            textTransform: "none",
            backgroundColor: isUnknownUser ? "#444" : "#06b6d4",
            "&:hover": {
              backgroundColor: isUnknownUser ? "#444" : "#00bcd4",
            },
          }}
        >
          {isUnknownUser ? "Unavailable" : "Send"}
        </Button>
      </Box>
    </>
  );
};

export default InputArea;
