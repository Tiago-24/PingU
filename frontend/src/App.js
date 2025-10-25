import React, { useState, useRef, useEffect } from "react";
import { Box, Button, Typography } from "@mui/material";
import { Dialog, DialogTitle, DialogContent } from "@mui/material";

// Hooks
import { useMessagesWebSocket, useUserWebSocket, useGroupWebSocket } from "./Hooks/useWebsockets";
import useMessages from "./Hooks/useMessages";
import useUsers from "./Hooks/useUsers";
import useGroups from "./Hooks/useGroups";

// Authentication
import AuthWrapper from "./Components/Authentication/AuthWrapper";

// Contact List
import ContactListWrapper from "./Components/Contacts/ContactListWrapper";

// Messages imports
import MessageArea from "./Components/Messages/MessageArea";
import InputArea from "./Components/Messages/InputArea";
import Header from "./Components/Messages/Header";

// Layout
import ChatShell from "./Components/ChatShell";

function App() {
  const [input, setInput] = useState("");
  const [user, setUser] = useState(null); // { id, username }
  const [chatWith, setChatWith] = useState(null);
  const [chatGroup, setChatGroup] = useState(null); // id para group
  const [socket, setSocket] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastMessages, setLastMessages] = useState({});
  const messagesEndRef = useRef(null);
  const [showPendingInvites, setShowPendingInvites] = useState(false);

  const { messages, setMessages } = useMessages(user, chatWith, chatGroup, refreshKey);
  const { users, setUsers, contacts, setContacts, unreadCounts, setUnreadCounts, pendingInvites, setPendingInvites } = useUsers(user, refreshKey);
  const { groups, setGroups } = useGroups(user, refreshKey);

  const [lastGroupEvent] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // 🔹 Carregar unread counts e last messages logo ao fazer login
  useEffect(() => {
    if (!user) return;

    const headers = { Authorization: `Bearer ${user.token}` };

    Promise.all([
      fetch(`/api/message/conversations/${user.id}`, { headers }),
      fetch(`/api/message/conversations/${user.id}/unread`, { headers }),
    ])
      .then(async ([convRes, unreadRes]) => ({
        convs: await convRes.json(),
        unread: await unreadRes.json(),
      }))
      .then(({ convs, unread }) => {
        console.log("📨 [LOGIN] unread data from backend:", unread);
        // preparar últimas mensagens
        const lm = {};
        (convs.users || []).forEach(u => {
          if (u.last_message)
            lm[u.username] = { text: u.last_message, time: u.last_timestamp };
        });
        (convs.groups || []).forEach(g => {
          if (g.last_message)
            lm[`group:${g.id}`] = { text: g.last_message, time: g.last_timestamp };
        });
        setLastMessages(lm);

        // achatar unreads vindos do backend
        setUnreadCounts(unread);
      })
      .catch(console.error);
  }, [user, setUnreadCounts]);
  
  // 🔊 Pré-carregar e desbloquear o áudio de notificações após login
  useEffect(() => {
    if (!user) return;

    const audio = new Audio("/sounds/notification.mp3");
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      console.log("🔊 Notification sound unlocked for playback");
    }).catch(() => {
      console.warn("🔇 Audio locked until user interacts");
    });
  }, [user]);

  
  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to permanently delete your account?")) return;
  
    try {
      const res = await fetch(`/api/user/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      });
  
      if (res.ok) {
        // Limpa localStorage, desconecta WebSockets e redireciona para login
        localStorage.removeItem("user");
        window.location.href = "/login";
      } else {
        alert("Could not delete account. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting account");
    }
  };

  useMessagesWebSocket(user, chatWith, chatGroup, setMessages, setRefreshKey, setLastMessages, setSocket, setUnreadCounts);
  useUserWebSocket(user, setUsers, setContacts, setPendingInvites, setOnlineUsers);
  useGroupWebSocket(user, setGroups, lastGroupEvent, (deletedGroupId) => {setChatGroup((prev) => {
                                                                            if (prev && prev.id === deletedGroupId) return null;
                                                                            return prev;
                                                                          });
                                                                          setChatWith(null);
                                                                          setMessages([]);
                                                                        });

  const respondInvite = (inviteId, accept) => {
    fetch(`/api/user/contacts/invite/${inviteId}/respond?accept=${accept}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${user.token}` },
    })
      .then(() => {
        setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
        setRefreshKey(prev => prev + 1);
      })
      .catch(console.error);
  };

  // Auth
  if (!user) {
    return (
      <AuthWrapper
        showRegister={showRegister}
        setShowRegister={setShowRegister}
        setUser={setUser}
      />
    );
  }

  // ---------- TOP BAR ----------
  const TopBar = (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "linear-gradient(90deg,rgb(7, 16, 31) 0%,rgb(15, 28, 48) 100%)",
        borderRadius: 2,
        px: 3,
        py: 2,
        mb: 2,
        boxShadow: "0 0 12px rgba(0,0,0,0.3)",
      }}
    >
      {/* Left side — welcome text + invites */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Typography
          variant="h6"
          sx={{
            color: "white",
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          👋 Hello, <span style={{ color: "#06b6d4" }}>{user.username}</span>
        </Typography>
  
        {pendingInvites.length > 0 && (
          <Button
            onClick={() => setShowPendingInvites(true)}
            sx={{
              ml: 1,
              color: "white",
              borderColor: "#06b6d4",
              borderWidth: 2,
              fontWeight: 600,
              borderRadius: "999px",
              textTransform: "none",
              "&:hover": {
                backgroundColor: "rgba(6,182,212,0.1)",
                borderColor: "white",
              },
            }}
            variant="outlined"
            size="small"
          >
            Pending Invites ({pendingInvites.length})
          </Button>
        )}
      </Box>
  
      {/* Right side — buttons */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Button
          variant="outlined"
          onClick={() => setUser(null)} // logout
          sx={{
            color: "white",
            borderColor: "rgba(255,255,255,0.4)",
            borderWidth: 2,
            fontWeight: 600,
            textTransform: "none",
            borderRadius: "999px",
            "&:hover": {
              borderColor: "#06b6d4",
              backgroundColor: "rgba(6,182,212,0.08)",
            },
          }}
        >
          Logout
        </Button>
  
        <Button
          variant="contained"
          color="error"
          onClick={handleDeleteAccount}
          sx={{
            borderRadius: "999px",
            textTransform: "none",
            fontWeight: 600,
            px: 2.5,
            "&:hover": {
              backgroundColor: "#b71c1c",
            },
          }}
        >
          Delete Account
        </Button>
      </Box>
    </Box>
  );
  
  // ---------- LEFT ----------
  const Sidebar = (
    <ContactListWrapper
      user={user}
      refreshKey={refreshKey}
      users={users}
      groups={groups}
      contacts={contacts}
      setContacts={setContacts}
      unreadCounts={unreadCounts}
      lastMessages={lastMessages}
      setChatWith={setChatWith}
      setChatGroup={setChatGroup}
      onlineUsers={onlineUsers}
      setRefreshKey={setRefreshKey}
      setShowCreateGroup={setShowCreateGroup}
      showCreateGroup={showCreateGroup}
      setUnreadCounts={setUnreadCounts}
    />
  );

  // ---------- RIGHT ----------
  const ChatRight = (!chatWith && !chatGroup) ? (
    <Box
      sx={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        color: "rgba(255,255,255,0.6)",
        bgcolor: "transparent",
      }}
    >
      Select a contact to start talking!
    </Box>
  ) : (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        bgcolor: "transparent",
      }}
    >
      {/** HEADER **/}
      <Box sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)", mb: 2}}>
        <Header
          chatWith={chatWith}
          chatGroup={chatGroup}
          user={user}
          setChatWith={setChatWith}
          setChatGroup={setChatGroup}
          setMessages={setMessages}
          lastGroupEvent={lastGroupEvent}
        />
      </Box>

      {/* Mensagens */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <MessageArea
          messages={messages}
          user={user}
          messagesEndRef={messagesEndRef}
          setMessages={setMessages}
          setReplyTarget={setReplyTarget}
        />
      </Box>

      {/* Input */}
      <InputArea
        input={input}
        setInput={setInput}
        socket={socket}
        chatWith={chatWith}
        chatGroup={chatGroup}
        user={user}
        setLastMessages={setLastMessages}
        replyTarget={replyTarget}
        setReplyTarget={setReplyTarget}
      />

    </Box>
  );

  return (
    <>
      <ChatShell topBar={TopBar} left={Sidebar} right={ChatRight} />

      {/* INVITES*/}
      <Dialog open={showPendingInvites} onClose={() => setShowPendingInvites(false)}>
        <DialogTitle>Pending Contact Invites</DialogTitle>
        <DialogContent>
          {pendingInvites.length === 0 ? (
            <Typography>No pending invites</Typography>
          ) : (
            pendingInvites.map(invite => (
              <Box key={`invite-${invite.id}`} sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography>{invite.from_username}</Typography>
                <Box>
                  <Button size="small" onClick={() => respondInvite(invite.id, true)}>Accept</Button>
                  <Button size="small" onClick={() => respondInvite(invite.id, false)}>Decline</Button>
                </Box>
              </Box>
            ))
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default App;
