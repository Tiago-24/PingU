import { useEffect, useRef } from "react";

// Hook para WebSocket de usuários
export const useUserWebSocket = (user, setUsers, setContacts, setPendingInvites, setOnlineUsers) => {
  useEffect(() => {
    if (!user) return;

    const wsUsers = new WebSocket(`${window.location.origin.replace(/^http/, "ws")}/api/user/ws/users?token=${user.token}`);

    wsUsers.onopen = () => console.log("✅ Connected to User WS");
    wsUsers.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "user_created") {
        setUsers((prev) => [...prev, { id: data.id, username: data.username }]);
      }

      if (data.type === "invite_received") {
        setPendingInvites((prev) => [...prev, data.invite]);
      }

      if (data.type === "contact_added") {
        setContacts((prev) => [...prev, data.user]);
        setPendingInvites((prev) => prev.filter(inv => inv.from_user_id !== data.user.id));
      }

      if (data.type === "user_online") {
        setOnlineUsers((prev) => {
          if (prev.includes(data.user_id)) return prev;
          return [...prev, data.user_id];
        });
      }

      if (data.type === "online_users") {
        setOnlineUsers(data.user_ids || []);
      }      

      if (data.type === "user_offline") {
        setOnlineUsers((prev) => prev.filter((id) => id !== data.user_id));
      }
    };

    wsUsers.onclose = () => console.log("❌ User WS disconnected");

    return () => wsUsers.close();
  }, [user, setUsers, setContacts, setPendingInvites, setOnlineUsers]);
};




// Hook para WebSocket de grupos
export const useGroupWebSocket = (user, setGroups, onGroupEvent, onGroupDeleted) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user) return;

    const wsGroups = new WebSocket(`${window.location.origin.replace(/^http/, "ws")}/api/group/ws/groups/${user.id}?token=${user.token}`);

    wsGroups.onopen = () => console.log("✅ Connected to Group WS");

    wsGroups.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // --- eventos de grupo (já existentes)
        if (data.type === "group_created") {
          if (data.member_ids?.includes(user.id)) {
            setGroups((prev) => [...prev, { id: data.id, name: data.name }]);
          }
        }        
        if (data.type === "group_deleted") {
          setGroups((prev) => prev.filter((g) => g.id !== data.id));
          if (onGroupDeleted) onGroupDeleted(data.id); // 👈 call the handler
        }
        if (data.type === "group_left") {
          if (data.user_id === user.id) {
            setGroups((prev) => prev.filter((g) => g.id !== data.group_id));
          }
        }
        if (data.type === "group_joined") {
          if (data.username === user.username) {
            setGroups((prev) => {
              if (prev.find((g) => g.id === data.group_id)) return prev;
              return [...prev, { id: data.group_id, name: data.group_name }];
            });
          }
        }
        if (data.type === "group_sentoff") {
          if (data.username === user.username) {
            setGroups((prev) => prev.filter((g) => g.id !== data.group_id));
          }
        }
        

        // --- NOVOS: eventos de membros (passa para quem quiser ouvir)
        if (["member_added", "member_removed"].includes(data.type)) {
          if (onGroupEvent) onGroupEvent(data);
        }

      } catch (err) {
        console.error("Invalid WS message from group-service:", event.data, err);
      }
    };

    wsGroups.onclose = () => console.log("❌ Group WS disconnected");

    return () => wsGroups.close();
  }, [user?.id, user?.token]);
  // [user, setGroups, onGroupEvent, onGroupDeleted]
};





const playNotificationSound = () => {
  const audio = new Audio("/sounds/notification.mp3"); // mete o ficheiro em public/sounds/
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

export const useMessagesWebSocket = (
  user,
  chatWith,
  chatGroup,
  setMessages,
  setRefreshKey,
  setLastMessages,
  setSocket,
  setUnreadCounts
) => {
  // estado instantâneo do chat aberto (sem esperar re-render)
  const currentChatRef = useRef({ with: null, group: null });

  useEffect(() => {
    currentChatRef.current = {
      with: chatWith?.username || null,
      group: chatGroup?.id || null,
    };
  }, [chatWith, chatGroup]);


  useEffect(() => {
    if (!user) return;

    // helpers: refaz fetch ao backend
    const refreshUnreadAndLast = async () => {
      if (!user) return;
      const headers = { Authorization: `Bearer ${user.token}` };
      try {
        const [unreadRes, convRes] = await Promise.all([
          fetch(`/api/message/conversations/${user.id}/unread`, { headers }),
          fetch(`/api/message/conversations/${user.id}`, { headers }),
        ]);
        const unread = await unreadRes.json();
        const convs = await convRes.json();

        setUnreadCounts(unread);

        const lm = {};
        (convs.users || []).forEach(u => {
          if (u.last_message) lm[u.username] = { text: u.last_message, time: u.last_timestamp };
        });
        (convs.groups || []).forEach(g => {
          if (g.last_message) lm[`group:${g.id}`] = { text: g.last_message, time: g.last_timestamp };
        });
        setLastMessages(lm);
      } catch (e) {
        console.error("Erro a refrescar unread/last:", e);
      }
    };

    const ws = new WebSocket(`${window.location.origin.replace(/^http/, "ws")}/api/message/ws/${user.id}?token=${user.token}`);
    ws.onopen = () => console.log("✅ Connected to WebSocket");

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        // apagar conversas/mensagens
        if (data.type === "conversation_deleted") {
          setMessages([]);
          await refreshUnreadAndLast();
          setRefreshKey((prev) => prev + 1);
          return;
        }
        if (data.type === "delete") {
          setMessages((prev) => {
            const updated = prev.filter((m) => m.id !== data.id);
            const active = currentChatRef.current;
        
            // Atualizar last message preview
            if (updated.length > 0) {
              const last = updated[updated.length - 1];
              if (active.with) {
                setLastMessages((prev) => ({
                  ...prev,
                  [active.with]: {
                    text: last.content,
                    time: last.timestamp,
                  },
                }));
              } else if (active.group) {
                setLastMessages((prev) => ({
                  ...prev,
                  [`group:${active.group}`]: {
                    text: `${last.from}: ${last.content}`,
                    time: last.timestamp,
                  },
                }));
              }
            } else {
              // Se ficou vazio, remove a preview
              if (active.with) {
                setLastMessages((prev) => {
                  const copy = { ...prev };
                  delete copy[active.with];
                  return copy;
                });
              } else if (active.group) {
                setLastMessages((prev) => {
                  const copy = { ...prev };
                  delete copy[`group:${active.group}`];
                  return copy;
                });
              }
            }
        
            return updated;
          });
        
          // 👇 força um re-render visual imediato
          setRefreshKey((prev) => prev + 1);
          return;
        }
          
                

        // É o chat aberto?
        const active = currentChatRef.current;
        const isCurrentChat =
          (data.type === "direct" &&
            (data.from === active.with || data.to === active.with)) ||
          (data.type === "group" && active.group === data.group);

        if (isCurrentChat) {
          setMessages((prev) => [...prev, data]);
        } else {
          // 🔔 Som apenas se a mensagem for relevante para este user
          if (data.type === "direct") {
            if (data.to === user.username) {
              playNotificationSound();
            }
          } else if (data.type === "group") {
            // alguns servidores enviam info dos membros
            if (data.group_members?.includes?.(user.username)) {
              playNotificationSound();
            }
          }
        }

        // dentro ws.onmessage, antes de await refreshUnreadAndLast()
        if (isCurrentChat && data.type === "direct") {
          // marca conversa direta como lida
          fetch(`/api/message/conversations/${user.id}/read/${chatWith.id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${user.token}` },
          }).catch(console.error);
        }

        if (isCurrentChat && data.type === "group") {
          // marca mensagens de grupo como lidas
          fetch(`/api/message/conversations/${user.id}/groups/${chatGroup.id}/read`, {
            method: "POST",
            headers: { Authorization: `Bearer ${user.token}` },
          }).catch(console.error);
        }

        // Em todos os casos, refrescar unread + last a partir do backend
        await refreshUnreadAndLast();

        setRefreshKey((prev) => prev + 1);
      } catch (err) {
        console.error("❌ WS parse error:", err, event.data);
      }
    };
    
    ws.onclose = (event) => {
      console.log("❌ WS Closed:", event.code, event.reason);
    };    
    setSocket(ws);
    return () => ws.close();
  }, [user, setMessages, setRefreshKey, setLastMessages, setSocket, setUnreadCounts, chatWith?.id, chatGroup?.id]);
};

