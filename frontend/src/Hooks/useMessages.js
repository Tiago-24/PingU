// src/hooks/useMessages.js
import { useEffect, useState } from "react";

const useMessages = (user, chatWith, chatGroup, refreshKey) => {
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        if (!user) return;

        if (chatWith) {
        // Conversa 1-to-1
        fetch(`/api/message/messages/${user.id}/${chatWith.id}`, {
            headers: {
            "Authorization": `Bearer ${user.token}`
            }
        })
            .then((res) => res.json())
            .then((data) => Array.isArray(data) ? setMessages(data) : setMessages([]))
            .catch((err) => console.error("Erro a buscar histórico:", err));
        }

        if (chatGroup) {
        // Conversa em grupo
        fetch(`/api/message/group_messages/${chatGroup.id}`, {
            headers: {
            "Authorization": `Bearer ${user.token}`
            }
        })
            .then((res) => res.json())
            .then((data) => Array.isArray(data) ? setMessages(data) : setMessages([]))
            .catch((err) => console.error("Erro a buscar histórico de grupo:", err));
        }
    }, [user, chatWith, chatGroup, refreshKey]);

    return { messages, setMessages };
};

export default useMessages;
