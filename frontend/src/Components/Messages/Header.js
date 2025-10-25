import React, { useState, useEffect } from "react";
import { Box, Typography, Avatar, IconButton, Tooltip } from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";

import GroupMembersModal from "./GroupMembersModal";

function initialOf(text = "") {
  const t = String(text).trim();
  return t ? t[0].toUpperCase() : "?";
}

const Header = ({
  chatWith,
  chatGroup,
  user,
  setChatWith,
  setChatGroup,
  setMessages,
  lastGroupEvent,
}) => {
  const [openMembers, setOpenMembers] = useState(false);
  const [ownerUsername, setOwnerUsername] = useState(null);

  const isGroup = Boolean(chatGroup);
  const name =
  (chatWith?.username?.startsWith("UnknownUser_")
    ? "Unknown User"
    : chatWith?.username) ||
  chatGroup?.name ||
  "";

  // 🧠 Fetch group owner when chatGroup changes
  useEffect(() => {
    if (!isGroup || !chatGroup || !user) return;
    fetch(`/api/group/groups/${chatGroup.id}/info`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then((r) => r.json())
      .then((info) => setOwnerUsername(info.owner_username))
      .catch(console.error);
  }, [chatGroup, user, isGroup]);

  const isOwner = user?.username === ownerUsername;

  // Back
  const handleBack = () => {
    setChatWith(null);
    setChatGroup(null);
  };

  // Leave (everyone can leave)
  const handleLeave = () => {
    if (chatGroup && user) {
      fetch(`/api/group/groups/${chatGroup.id}/leave/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      }).then(() => {
        setChatGroup(null);
        setChatWith(null);
      });
    }
  };

  // Delete (only owner)
  const handleDelete = () => {
    const confirmed = window.confirm(
      chatWith
        ? `Do you really want to delete your conversation with ${chatWith.username}?`
        : `Do you really want to delete the group "${chatGroup.name}"?`
    );

    if (confirmed && user) {
      const endpoint = chatWith
        ? `/api/message/conversations/${user.id}/${chatWith.id}`
        : `/api/message/group_conversations/${chatGroup.id}`;

      fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      })
        .then(() => {
          setMessages([]);
          setChatGroup(null);
          setChatWith(null);
        })
        .catch((err) => console.error("Erro:", err));
    }
  };

  return (
    <Box
      sx={{
        height: 64,
        px: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        bgcolor: "#0b1220",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        color: "white",
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Tooltip title="Back">
          <IconButton
            size="small"
            onClick={handleBack}
            sx={{ color: "rgba(255,255,255,0.9)" }}
          >
            <ArrowBackIosNewRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Avatar
          sx={{
            width: 36,
            height: 36,
            bgcolor: isGroup ? "secondary.main" : "primary.main",
            fontWeight: 700,
          }}
        >
          {initialOf(name)}
        </Avatar>

        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {name}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {isGroup && (
          <>
            {/* Everyone can leave */}
            <Tooltip title="Leave group">
              <IconButton
                size="small"
                color="warning"
                onClick={handleLeave}
                sx={{
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.08)" },
                }}
              >
                <LogoutRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* See members */}
            <Tooltip title="Group members">
              <IconButton
                size="small"
                sx={{ color: "rgba(255,255,255,0.9)" }}
                onClick={() => setOpenMembers(true)}
              >
                <PeopleRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <GroupMembersModal
              open={openMembers}
              onClose={() => setOpenMembers(false)}
              group={chatGroup}
              user={user}
              lastGroupEvent={lastGroupEvent}
            />

            {/* 🧱 Only the owner can delete the group */}
            {isOwner && (
              <Tooltip title="Delete conversation">
                <IconButton
                  size="small"
                  color="error"
                  onClick={handleDelete}
                  sx={{
                    "&:hover": { backgroundColor: "rgba(255,255,255,0.08)" },
                  }}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}

        {/* For 1:1 chats, still show delete */}
        {!isGroup && (
          <Tooltip title="Delete conversation">
            <IconButton
              size="small"
              color="error"
              onClick={handleDelete}
              sx={{
                "&:hover": { backgroundColor: "rgba(255,255,255,0.08)" },
              }}
            >
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

export default Header;
