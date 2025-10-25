// src/Components/Contacts/ContactListWrapper.js
import ContactList from "./ContactList";
import CreateGroupDialog from "./CreateGroupDialog";

const ContactListWrapper = ({
  user,
  onlineUsers,
  refreshKey,
  users,
  groups,
  contacts,
  setContacts,
  unreadCounts,
  lastMessages,
  setChatWith,
  setChatGroup,
  setRefreshKey,
  setShowCreateGroup,
  showCreateGroup,
  setUnreadCounts
}) => {

  return (
    <>
      <ContactList
        currentUser={user}
        refreshKey={refreshKey}
        contacts={contacts}
        setContacts={setContacts}
        users={users}
        groups={groups}
        unread={unreadCounts}
        setUnread={setUnreadCounts}
        user_token={user.token}
        onlineUsers={onlineUsers}
        onSelectContact={(contact) => {
          setChatWith(contact);
          setChatGroup(null);
        
          if (!user) return;
          const headers = { Authorization: `Bearer ${user.token}` };
          fetch(`/api/message/conversations/${user.id}/read/${contact.id}`, {
            method: "POST",
            headers,
          })
            .then(() =>
              fetch(`/api/message/conversations/${user.id}/unread`, { headers })
            )
            .then((res) => res.json())
            .then((unread) => {
              setUnreadCounts(unread);
              setRefreshKey((prev) => prev + 1);
            })
            .catch(console.error);
        }}
        
        // onSelectGroup
        onSelectGroup={(group) => {
          setChatWith(null);
          setChatGroup(group);
        
          if (!user) return;
          const headers = { Authorization: `Bearer ${user.token}` };
          fetch(`/api/message/conversations/${user.id}/groups/${group.id}/read`, {
            method: "POST",
            headers,
          })
            .then(() =>
              fetch(`/api/message/conversations/${user.id}/unread`, { headers })
            )
            .then((res) => res.json())
            .then((unread) => {
              setUnreadCounts(unread);
              setRefreshKey((prev) => prev + 1);
            })
            .catch(console.error);
        }}
        onCreateGroup={() => setShowCreateGroup(true)}
        lastMessages={lastMessages}
      />

      <CreateGroupDialog
        open={showCreateGroup}
        currentUser={user}
        contacts={contacts}
        onClose={(created) => {
          setShowCreateGroup(false);
          if (created) {
            setRefreshKey((prev) => prev + 1); // força reload
          }
        }}
      />
    </>
  );
};

export default ContactListWrapper;
