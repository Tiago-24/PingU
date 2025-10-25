import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  IconButton,
  TextField,
  Button,
  Typography,
  Divider,
} from "@mui/material";
import { useState, useEffect } from "react";

const GroupMembersModal = ({ open, onClose, group, user, lastGroupEvent }) => {
  const [members, setMembers] = useState([]);
  const [newMemberUsername, setNewMemberUsername] = useState("");
  const [ownerUsername, setOwnerUsername] = useState(null);

  useEffect(() => {
    if (!group || !user) return;
    fetch(`/api/group/groups/${group.id}/info`, {
      headers: { Authorization: `Bearer ${user.token}` }
    })
      .then(r => r.json())
      .then(info => setOwnerUsername(info.owner_username))
      .catch(console.error);
  }, [group, user]);


  useEffect(() => {
    if (!lastGroupEvent || !group) return;
    const e = lastGroupEvent;

    if (e.group_id !== group.id) return;

    if (e.type === "member_added") {
      setMembers((prev) => {
        if (prev.find((m) => m.username === e.username)) return prev;
        return [...prev, { username: e.username }];
      });
    }

    if (e.type === "member_removed") {
      setMembers((prev) => prev.filter((m) => m.username !== e.username));
    }
  }, [lastGroupEvent, group]);

  useEffect(() => {
    if (!group || !user) return;
    fetch(`/api/group/groups/${group.id}/members`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then((res) => res.json())
      .then(setMembers)
      .catch((err) => console.error("Erro a obter membros:", err));
  }, [group, user]);

  const handleAdd = () => {
    if (!newMemberUsername.trim()) return;

    fetch(`/api/group/groups/${group.id}/members?username=${newMemberUsername}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setMembers((prev) => [...prev, data.user]);
          setNewMemberUsername("");
        }
      })
      .catch((err) => console.error("Erro ao adicionar membro:", err));
  };

  const handleRemove = (username) => {
    fetch(`/api/group/groups/${group.id}/members/${username}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then(() => setMembers((prev) => prev.filter((m) => m.username !== username)))
      .catch((err) => console.error(err));
  };

  const isOwner = user?.username === ownerUsername;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: "#0b1220",
          color: "white",
          borderRadius: 2,
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: "1.1rem", pb: 1 }}>
        👥 Group Members
      </DialogTitle>

      <DialogContent>
        {members.length > 0 ? (
          <List sx={{ mb: 2 }}>
            {members.map((m) => (
            <ListItem
              key={m.username}
              sx={{
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                py: 0.75,
              }}
              secondaryAction={
                // only show delete icon if current user is owner and member isn't owner
                isOwner && m.username !== ownerUsername ? (
                  <IconButton
                    edge="end"
                    color="error"
                    size="small"
                    onClick={() => handleRemove(m.username)}
                    sx={{
                      "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
                    }}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                ) : null
              }
            >
              <ListItemAvatar>
                <Avatar
                  sx={{
                    width: 30,
                    height: 30,
                    bgcolor: "#2e3b55",
                    fontSize: "0.9rem",
                    textTransform: "uppercase",
                  }}
                >
                  {m.username[0]}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  m.username === ownerUsername
                    ? `${m.username} 👑`
                    : m.username
                }
              />
            </ListItem>
          ))}
          </List>
        ) : (
          <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
            No members yet.
          </Typography>
        )}

        <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", mb: 2 }} />

        {isOwner && (
          <Box display="flex" gap={1}>
            <TextField
              fullWidth
              size="small"
              label="Username"
              variant="outlined"
              value={newMemberUsername}
              onChange={(e) => setNewMemberUsername(e.target.value)}
              placeholder="ex: vasco"
              InputLabelProps={{ style: { color: "#ccc" } }}
              InputProps={{
                style: {
                  color: "white",
                  backgroundColor: "#111a2d",
                  borderRadius: "8px",
                },
              }}
            />
            <Button
              variant="contained"
              onClick={handleAdd}
              sx={{
                bgcolor: "#1976d2",
                "&:hover": { bgcolor: "#1565c0" },
                textTransform: "none",
                fontWeight: 600,
                px: 2,
              }}
              startIcon={<PersonAddAlt1RoundedIcon />}
            >
              Add
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GroupMembersModal;
