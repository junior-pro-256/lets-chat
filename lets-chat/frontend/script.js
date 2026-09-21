const user = JSON.parse(localStorage.getItem('user'));
if (!user) window.location.href = 'index.html';

const BASE_URL = API_URL.replace(/\/api\/?$/, '');
const socket = io('https://lets-chat-9dy1.onrender.com');

let chats = [];
let allUsers = [];
let currentChat = null;
let onlineUsers = new Set();
let groupSelectedUsers = [];

// DOM Elements
const chatList = document.getElementById('chat-list');
const usersList = document.getElementById('users-list');
const chatHeader = document.getElementById('chat-header');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const fileInput = document.getElementById('file-input');
const typingIndicator = document.getElementById('typing-indicator');
const userSearch = document.getElementById('user-search');
const topbarUsername = document.getElementById('topbar-username');
const topbarAvatar = document.getElementById('topbar-avatar');
const topbarAvatarInput = document.getElementById('topbar-avatar-input');

// --- AVATAR HELPERS ---
const AVATAR_COLORS = ['#0084ff', '#f44336', '#4caf50', '#ff9800', '#9c27b0', '#009688', '#795548'];
function colorForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function avatarHTML(u, size) {
  const style = size ? `style="width:${size}px;height:${size}px;"` : '';
  if (u.avatar) {
    return `<img class="avatar-img" ${style} src="${BASE_URL}${u.avatar}" alt="${u.username}">`;
  }
  const initial = (u.username || '?').charAt(0).toUpperCase();
  return `<div class="avatar-fallback" ${style} style="background-color:${colorForId(u._id || u.id)};${size ? `width:${size}px;height:${size}px;` : ''}">${initial}</div>`;
}

// --- TOPBAR PROFILE ---
function renderTopbar() {
  topbarUsername.innerText = user.username;
  if (user.avatar) {
    topbarAvatar.src = `${BASE_URL}${user.avatar}`;
    topbarAvatar.style.display = 'inline-block';
  } else {
    topbarAvatar.style.display = 'none';
  }
}
renderTopbar();

topbarAvatar.addEventListener('click', () => topbarAvatarInput.click());
topbarAvatarInput.addEventListener('change', async () => {
  const file = topbarAvatarInput.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('avatar', file);
  try {
    const updatedUser = await apiRequest('/auth/profile/avatar', 'PUT', formData, true);
    user.avatar = updatedUser.avatar;
    localStorage.setItem('user', JSON.stringify(user));
    renderTopbar();
  } catch (err) {
    alert(err.message);
  }
});

// Modal Elements
const groupModal = document.getElementById('group-modal');
const openGroupBtn = document.getElementById('open-group-modal');
const closeGroupBtn = document.getElementById('close-group-btn');
const groupSearch = document.getElementById('group-search');
const groupSearchResults = document.getElementById('group-search-results');
const createGroupBtn = document.getElementById('create-group-btn');

// --- SOCKET CONNECTIONS ---
socket.emit('setup', user);

socket.on('user_status', ({ userId, isOnline }) => {
  if (isOnline) onlineUsers.add(userId);
  else onlineUsers.delete(userId);
  renderChats();
  renderUsersList();
});

socket.on('message_received', (newMessage) => {
  if (currentChat && currentChat._id === newMessage.chat._id) {
    appendMessage(newMessage);
  }
});

socket.on('typing', () => typingIndicator.style.display = 'block');
socket.on('stop_typing', () => typingIndicator.style.display = 'none');

// --- INITIAL FETCH ---
async function loadChats() {
  chats = await apiRequest('/chats');
  renderChats();
}

async function loadAllUsers() {
  allUsers = await apiRequest('/auth/users');
  renderUsersList();
}

loadChats();
loadAllUsers();

// --- RENDER CHATS ---
function renderChats() {
  chatList.innerHTML = '';
  chats.forEach(chat => {
    const isGroup = chat.isGroupChat;
    const otherUser = isGroup ? null : chat.users.find(u => u._id !== user.id);
    const chatName = isGroup ? chat.chatName : (otherUser ? otherUser.username : 'Chat');
    const isOnline = otherUser && onlineUsers.has(otherUser._id);

    const div = document.createElement('div');
    div.className = `chat-item ${currentChat && currentChat._id === chat._id ? 'active' : ''}`;
    div.innerHTML = `
      ${isGroup ? '<span class="status-dot offline"></span>' : avatarHTML(otherUser || { username: chatName, _id: chat._id })}
      <div>
        <div class="chat-item-name"><strong>${chatName}</strong>${!isGroup ? `<span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>` : ''}</div>
        <div style="font-size: 12px; color: #666;">${chat.latestMessage ? chat.latestMessage.text : 'No messages'}</div>
      </div>
    `;
    div.addEventListener('click', () => selectChat(chat));
    chatList.appendChild(div);
  });
}

// --- RENDER ALL USERS (sidebar) ---
function renderUsersList(filter) {
  const query = (filter || '').trim().toLowerCase();
  const list = query
    ? allUsers.filter(u => u.username.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
    : allUsers;

  usersList.innerHTML = '';
  if (list.length === 0) {
    usersList.innerHTML = '<div style="padding: 10px 15px; font-size: 12px; color: #777;">No users found</div>';
    return;
  }

  list.forEach(u => {
    const isOnline = onlineUsers.has(u._id);
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `
      ${avatarHTML(u)}
      <div>
        <div class="chat-item-name"><strong>${u.username}</strong><span class="status-dot ${isOnline ? 'online' : 'offline'}"></span></div>
        <div style="font-size: 12px; color: #666;">${isOnline ? 'Online' : 'Offline'}</div>
      </div>
    `;
    div.addEventListener('click', () => openChatWithUser(u));
    usersList.appendChild(div);
  });
}

// --- START/OPEN A CHAT WITH A CHOSEN USER ---
async function openChatWithUser(u) {
  const chat = await apiRequest('/chats', 'POST', { userId: u._id });
  if (!chats.find(c => c._id === chat._id)) chats.unshift(chat);
  userSearch.value = '';
  renderUsersList();
  selectChat(chat);
}

// --- SELECT CHAT ---
async function selectChat(chat) {
  currentChat = chat;
  renderChats();
  const isGroup = chat.isGroupChat;
  const otherUser = isGroup ? null : chat.users.find(u => u._id !== user.id);
  chatHeader.innerText = isGroup ? chat.chatName : otherUser.username;

  socket.emit('join_chat', chat._id);
  const messages = await apiRequest(`/messages/${chat._id}`);
  messagesContainer.innerHTML = '';
  messages.forEach(appendMessage);
}

// --- APPEND MESSAGE ---
function appendMessage(msg) {
  const isMe = msg.sender._id === user.id;
  const div = document.createElement('div');
  div.className = `message-bubble ${isMe ? 'sent' : 'received'}`;
  
  let content = '';
  if (!isMe && currentChat.isGroupChat) {
    content += `<div style="font-size: 10px; font-weight: bold;">${msg.sender.username}</div>`;
  }
  if (msg.text) content += `<div>${msg.text}</div>`;
  if (msg.fileUrl) {
    if (msg.fileType === 'image') {
      content += `<img src="${BASE_URL}${msg.fileUrl}" class="message-file-img">`;
    } else {
      content += `<a href="${BASE_URL}${msg.fileUrl}" target="_blank">📄 Download Attachment</a>`;
    }
  }

  div.innerHTML = content;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// --- FILE SELECT: append selected item to the text field before sending ---
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  const tag = `📎 ${file.name}`;
  const current = messageInput.value.trim();
  if (!current.includes(tag)) {
    messageInput.value = current ? `${current} ${tag}` : tag;
  }
  messageInput.focus();
});

// --- SEND MESSAGE ---
messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentChat) return alert('Select a chat first');

  const text = messageInput.value.trim();
  const file = fileInput.files[0];
  if (!text && !file) return;

  const formData = new FormData();
  formData.append('chatId', currentChat._id);
  if (text) formData.append('text', text);
  if (file) formData.append('file', file);

  const newMessage = await apiRequest('/messages', 'POST', formData, true);
  socket.emit('new_message', newMessage);
  appendMessage(newMessage);

  messageInput.value = '';
  fileInput.value = '';
});

// --- TYPING INDICATOR ---
messageInput.addEventListener('input', () => {
  if (!currentChat) return;
  socket.emit('typing', currentChat._id);
  setTimeout(() => socket.emit('stop_typing', currentChat._id), 3000);
});

// --- USER SEARCH (filters the "All Users" list) ---
userSearch.addEventListener('input', (e) => {
  renderUsersList(e.target.value);
});

// --- GROUP CHAT CREATION ---
openGroupBtn.addEventListener('click', () => groupModal.classList.remove('hidden'));
closeGroupBtn.addEventListener('click', () => groupModal.classList.add('hidden'));

groupSearch.addEventListener('input', async (e) => {
  const query = e.target.value.trim();
  if (!query) return;

  const users = await apiRequest(`/auth/users?search=${query}`);
  groupSearchResults.innerHTML = '';
  users.forEach(u => {
    const div = document.createElement('div');
    div.style.cursor = 'pointer';
    div.style.padding = '4px 0';
    div.innerText = `+ ${u.username}`;
    div.addEventListener('click', () => {
      addSelectedGroupUser(u);
    });
    groupSearchResults.appendChild(div);
  });
});

function addSelectedGroupUser(u) {
  if (!groupSelectedUsers.find(sel => sel._id === u._id)) {
    groupSelectedUsers.push(u);
    document.getElementById('group-selected-users').innerText =
      'Selected: ' + groupSelectedUsers.map(s => s.username).join(', ');
  }
}

createGroupBtn.addEventListener('click', async () => {
  const name = document.getElementById('group-name').value.trim();
  if (!name || groupSelectedUsers.length < 2) {
    return alert('Provide a group name and select at least 2 users');
  }

  const groupChat = await apiRequest('/chats/group', 'POST', {
    name,
    users: JSON.stringify(groupSelectedUsers.map(u => u._id))
  });

  chats.unshift(groupChat);
  groupModal.classList.add('hidden');
  selectChat(groupChat);
});
