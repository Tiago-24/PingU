import { useEffect, useState } from "react";

const useGroups = (user, refreshKey) => {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    if (!user?.id || !user?.token) return;

    fetch(`/api/group/groups/${user.id}`, {
      headers: {
        "Authorization": `Bearer ${user.token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setGroups(data || []))
      .catch((err) => console.error("Erro a carregar grupos:", err));
  }, [user, refreshKey]);

  return { groups, setGroups };
};

export default useGroups;
