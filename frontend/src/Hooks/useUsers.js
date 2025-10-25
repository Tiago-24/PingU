// src/hooks/useUsers.js
import { useEffect, useState } from "react";

const useUsers = (user, refreshKey) => {
  const [users, setUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({ direct: {}, groups: {} });
  const [pendingInvites, setPendingInvites] = useState([]);
  const [contacts, setContacts] = useState([]);

    useEffect(() => {
        if (!user) return;

        fetch(`/api/message/conversations/${user.id}/unread`, {
        headers: {
            "Authorization": `Bearer ${user.token}`
        }
        })
        .then((res) => res.json())
        .then((data) => setUnreadCounts(data))
        .catch((err) => console.error("Erro a carregar unread:", err));
    }, [user, refreshKey]);

    useEffect(() => {
        if (!user) return;

        fetch(`/api/message/conversations/${user.id}`, {
        headers: {
            "Authorization": `Bearer ${user.token}`
        }
        })
        .then((res) => res.json())
        .then((data) => {
            setUsers(data.users || []);
        })
        .catch((err) => console.error("Erro a carregar users:", err));
    }, [user, refreshKey]);

    useEffect(() => {
        if (!user) return;
        
        fetch(`/api/user/contacts/${user.id}`, {
          headers: { "Authorization": `Bearer ${user.token}` },
        })
          .then(res => res.json())
          .then(data => setContacts(data))
          .catch(console.error);
      }, [user, refreshKey]);
    
      useEffect(() => {
        if (!user) return;
      
        fetch(`/api/user/contacts/invites/${user.id}`, {
          headers: { "Authorization": `Bearer ${user.token}` },
        })
          .then((res) => res.json())
          .then(async (data) => {
            const enriched = await Promise.all(
              data.map(async (inv) => {
                const res = await fetch(`/api/user/users/${inv.from_user_id}`, {
                  headers: { "Authorization": `Bearer ${user.token}` },
                });
                const userData = await res.json();
                return { ...inv, from_username: userData.username };
              })
            );
            setPendingInvites(enriched);
          })
          .catch(console.error);
      }, [user, refreshKey]);
      
    
  return { users, setUsers, contacts, setContacts, unreadCounts, setUnreadCounts, pendingInvites, setPendingInvites};
};

export default useUsers;
