// src/Components/Contacts/AddPerson.js
import React, { useState, useEffect } from "react";
import { TextField, List, ListItem, ListItemText, Paper } from "@mui/material";

const AddPerson = ({ currentUser, contacts }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Função para carregar utilizadores
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const response = await fetch(`/api/user/users`, {
        headers: {
          "Authorization": `Bearer ${currentUser.token}`
        }
      });
      const data = await response.json();
      setUsers(data);
      setLoading(false);
    };

    fetchUsers();
  }, [searchQuery, currentUser]);

  const filteredUsers = users.filter(
    (u) => u.id !== currentUser.id && !contacts.some(c => c.id === u.id) && !u.username?.toLowerCase().includes("unknownuser")
  ).filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));

  // Enviar o convite para o utilizador
  const handleInvite = (user) => {
    fetch(`api/user/contacts/invite?from_user_id=${currentUser.id}&to_user_id=${user.id}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${currentUser.token}`
      }
    })    
    .then((res) => res.json())
    .then(() => {
      alert(`Invitation sent to ${user.username}`);
    })
    .catch((err) => console.error("Error sending invite", err));
  };

  return (
    <Paper sx={{ padding: 2, width: 400 }}>
      <TextField
        label="Search User"
        variant="outlined"
        fullWidth
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ marginBottom: 2 }}
      />
      {loading ? (
        <div>Loading...</div>
      ) : (
        <List>
          {filteredUsers.map((user) => (
            <ListItem
              button
              key={user.id}
              onClick={() => handleInvite(user)}
            >
              <ListItemText primary={user.username} />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default AddPerson;
