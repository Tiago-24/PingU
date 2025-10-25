import React, { useEffect, useState } from "react";
import {
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Button,
  Badge,
  IconButton,
  Tooltip,
  Box,
} from "@mui/material";
import {
  DeleteOutline,
  GroupAdd,
  PersonAddAlt1,
} from "@mui/icons-material";
import { Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import AddPerson from "./AddPerson";

const scrollAreaStyle = {
  overflowY: "auto",
  scrollBehavior: "smooth",
  scrollbarWidth: "thin",
  scrollbarColor: "rgba(255,255,255,0.1) transparent",
  pr: 0.5,
  "&::-webkit-scrollbar": {
    width: "4px",
    transition: "opacity 0.3s ease",
    opacity: 0, // hidden by default
  },
  "&:hover::-webkit-scrollbar": {
    opacity: 1, // visible on hover
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "4px",
  },
  "&:hover::-webkit-scrollbar-thumb": {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  "&::-webkit-scrollbar-track": {
    backgroundColor: "transparent",
  },
};


function initialOf(text = "") {
  const t = String(text).trim();
  return t ? t[0].toUpperCase() : "?";
}

function ContactList({
  currentUser,
  contacts,
  setContacts,
  users,
  groups,
  onSelectContact,
  onSelectGroup,
  onCreateGroup,
  lastMessages,
  unread,
  user_token,
  onlineUsers
}) {
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [owners, setOwners] = useState({});

  useEffect(() => {
    if (!groups || !currentUser || !user_token) return;
  
    const fetchOwners = async () => {
      const results = {};
      await Promise.all(
        groups.map(async (g) => {
          try {
            const res = await fetch(
              `/api/group/groups/${g.id}/info`,
              { headers: { Authorization: `Bearer ${user_token}` } }
            );
            if (res.ok) {
              const data = await res.json();
              results[g.id] = data.owner_username;
            }
          } catch (err) {
            console.error("Error fetching owner for group", g.name, err);
          }
        })
      );
      setOwners(results);
    };
  
    fetchOwners();
  }, [groups, currentUser, user_token]);
  

  const filteredUsers = users.filter((u) => contacts.some((c) => c.id === u.id));
  const uniqueContacts = Array.from(new Map(filteredUsers.map((c) => [c.id, c])).values());

  // Ordenar contactos
  const sortedContacts = [...uniqueContacts].sort((a, b) => {
    const timeA = lastMessages[a.id]?.time || a.last_timestamp;
    const timeB = lastMessages[b.id]?.time || b.last_timestamp;
    if (!timeA && !timeB) return 0;
    if (!timeA) return 1;
    if (!timeB) return -1;
    return new Date(timeB) - new Date(timeA);
  });

  // Ordenar grupos
  const sortedGroups = [...groups].sort((a, b) => {
    const timeA = lastMessages[`group:${a.id}`]?.time || a.last_timestamp;
    const timeB = lastMessages[`group:${b.id}`]?.time || b.last_timestamp;
    if (!timeA && !timeB) return 0;
    if (!timeA) return 1;
    if (!timeB) return -1;
    return new Date(timeB) - new Date(timeA);
  });

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "88vh",
        position: "relative",
        bgcolor: "#0b1220",
        overflow: "hidden",
      }}
    >
      {/* Static top header */}
      <Box sx={{ flexShrink: 0, p: 2, pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6">Contacts</Typography>
          <Tooltip title="Add Contact">
            <IconButton
              size="small"
              onClick={() => setShowAddPerson(true)}
              sx={{
                color: "white",
                "&:hover": { backgroundColor: "rgba(255,255,255,0.05)"},
              }}
            >
              <PersonAddAlt1 />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Scroll zones (the fixed mid split layout) */}
      <Box
        sx={{
          position: "relative",
          flex: 1, // takes remaining height
          overflow: "hidden",
        }}
      >
        {/* DIRECTS */}
        <Box
          sx={{
            ...scrollAreaStyle,
            position: "absolute",
            top: 0,
            height: "45%",
            bottom: "auto",
            left: 0,
            right: 0,
          }}
        >
          {/* Contact List */}
          <List dense disablePadding>
            {sortedContacts.map((c) => {
              const unreadCount = unread.direct?.[c.id] || 0;
              const secondary = lastMessages[c.id]?.text || c.last_message || "";

              // 🧠 Determina se é um utilizador apagado
              const isUnknown = !c.username || c.username.startsWith("UnknownUser_") || c.username === "Unknown User";

              return (
                <ListItem
                  key={`contact-${c.id}`}
                  onClick={() => onSelectContact(c)}
                  sx={{
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 0.5,
                    px: 1.5,
                    height: 68,
                    transition: "background 0.2s ease",
                    "&:hover": {
                      backgroundColor: "rgba(255,255,255,0.06)",
                    },
                  }}
                  secondaryAction={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Badge
                        color="primary"
                        badgeContent={unreadCount}
                        invisible={!unreadCount}
                      />
                  
                      <Tooltip title="Remove Contact">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              window.confirm(`Are you sure you want to remove "${c.username}" from your contacts?`) &&
                              user_token
                            ) {
                              fetch(`/api/user/contacts/${currentUser.id}/remove/${c.id}`, {
                                method: "DELETE",
                                headers: { Authorization: `Bearer ${user_token}` },
                              })
                                .then((res) => {
                                  if (!res.ok) throw new Error("Failed to remove contact");
                                  // remove from UI immediately
                                  setContacts((prev) => prev.filter((u) => u.id !== c.id));
                                })
                                .catch((err) => console.error("Error removing contact:", err));
                            }
                          }}
                          sx={{
                            "&:hover": { backgroundColor: "rgba(255,255,255,0.05)" },
                          }}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }                  
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: isUnknown ? "gray" : "#06b6d4",
                        fontWeight: 700,
                        fontSize: 16,
                      }}
                    >
                      {isUnknown ? "?" : initialOf(c.username)}
                    </Avatar>
                  </ListItemAvatar>

                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography
                          variant="body1"
                          sx={{
                            fontWeight: unreadCount > 0 ? 700 : 500,
                            color: isUnknown ? "rgba(255,255,255,0.5)" : "white",
                            fontStyle: isUnknown ? "italic" : "normal",
                          }}
                        >
                          {isUnknown ? "Unknown User" : c.username}
                        </Typography>

                        {!isUnknown &&
                          c.id !== currentUser.id &&
                          Array.isArray(onlineUsers) &&
                          onlineUsers.includes(c.id) && (
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                bgcolor: "#4caf50",
                                flexShrink: 0,
                              }}
                            />
                          )}
                      </Box>
                    }
                    secondary={
                      <Typography
                        variant="body2"
                        sx={{
                          color: isUnknown
                            ? "rgba(255,255,255,0.4)"
                            : "rgba(255,255,255,0.6)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 200,
                        }}
                      >
                        {secondary}
                      </Typography>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        </Box>

        {/* Lower half: Groups */}
        <Box
          sx={{
            position: "absolute",
            top: "45%",
            left: 0,
            right: 0,
            zIndex: 2,
            bgcolor: "#0b1220",
            //boxShadow: "0 -4px 0 0 rgba(255, 255, 255, 0.42)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            py: 1,
            px: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h6">Groups</Typography>
          <Tooltip title="Create Group">
            <IconButton
              size="small"
              onClick={onCreateGroup}
              sx={{ color: "white", "&:hover": { bgcolor: "rgba(255,255,255,0.08)" } }}
            >
              <GroupAdd />
            </IconButton>
          </Tooltip>
        </Box>

        {/* GROUPS */}
        <Box
          sx={{
            ...scrollAreaStyle,
            position: "absolute",
            top: "calc(45% + 48px)",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1
          }}
        >

            {/* Group List */}
            <List dense disablePadding>
              {sortedGroups.map((g) => {
                const unreadCount = unread.groups?.[g.id] || 0;
                const secondary = lastMessages[`group:${g.id}`]?.text || g.last_message || "";

                return (
                  <ListItem
                    key={`group-${g.id}`}
                    onClick={() => onSelectGroup(g)}
                    sx={{
                      cursor: "pointer",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 0.5,
                      px: 1.5,
                      height: 68,
                      transition: "background 0.2s ease",
                      "&:hover": {
                        backgroundColor: "rgba(255,255,255,0.06)",
                      },
                    }}
                    secondaryAction={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Badge
                          color="secondary"
                          badgeContent={unreadCount}
                          invisible={!unreadCount}
                        />
                        {owners[g.id] === currentUser.username && (
                          <Tooltip title="Delete Group">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  window.confirm(`Are you sure you want to delete group "${g.name}"?`) &&
                                  user_token
                                ) {
                                  fetch(`/api/group/groups/${g.id}/delete/${currentUser.id}`, {
                                    method: "DELETE",
                                    headers: { Authorization: `Bearer ${user_token}` },
                                  }).catch((err) =>
                                    console.error("Erro ao apagar grupo:", err)
                                  );
                                }
                              }}
                              sx={{
                                "&:hover": {
                                  backgroundColor: "rgba(255,255,255,0.05)",
                                },
                              }}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: "#0091b2",
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        {initialOf(g.name)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography
                          variant="body1"
                          sx={{
                            fontWeight: unreadCount > 0 ? 700 : 500,
                            color: "white",
                          }}
                        >
                          {g.name}
                        </Typography>
                      }
                      secondary={
                        <Typography
                          variant="body2"
                          sx={{
                            color: "rgba(255,255,255,0.6)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 200,
                          }}
                        >
                          {secondary}
                        </Typography>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
        </Box>
      </Box>

      

     

      {/* Dialog Add Person */}
      {showAddPerson && (
        <Dialog open={showAddPerson} onClose={() => setShowAddPerson(false)}>
          <DialogTitle>Add Person</DialogTitle>
          <DialogContent>
            <AddPerson currentUser={currentUser} contacts={contacts} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAddPerson(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

export default ContactList;
