import React, { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Checkbox, List, ListItem, FormControlLabel,
} from "@mui/material";

function CreateGroupDialog({ open, onClose, currentUser, contacts }) {
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState("");

  const resetForm = () => {
    setGroupName("");
    setSelected([]);
  };

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleClose = (created = false) => {
    resetForm();
    onClose(created);
  };

  const handleCreate = () => {
    if (!currentUser?.token) return;
    fetch(`/api/group/groups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.token}`,
      },
      body: JSON.stringify({
        name: groupName.trim(),
        member_ids: [currentUser.id, ...selected],
      }),
    })
      .then((res) => res.json())
      .then(() => handleClose(true))
      .catch((err) => console.error("Erro a criar grupo:", err));
  };

  return (
    <Dialog open={open} onClose={() => handleClose(false)}>
      <DialogTitle>Create Group</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Group Name"
          margin="normal"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />

        <List>
          {contacts.map((c) => (
            <ListItem key={c.id} disableGutters>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selected.includes(c.id)}
                    onChange={() => toggleSelect(c.id)}
                  />
                }
                label={c.username}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => handleClose(false)}>Cancel</Button>
        <Button
          onClick={handleCreate}
          disabled={!groupName.trim() || selected.length === 0}
          variant="contained"
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CreateGroupDialog;
