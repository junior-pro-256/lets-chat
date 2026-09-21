const user = JSON.parse(localStorage.getItem('user'));
if (!user) window.location.href = 'index.html';

const socket = io('http://localhost:5000');

let chats = [];
let currentChat = null;
let onlineUsers = new Set();
let groupSelectedUsers = [];

// DOM Elements
const chatList = document.getElementById('chat-list');
const chatHeader = document.getElementById('chat-header');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const fileInput = document.getElementById('file-input');
const typingIndicator = document.getElementById('typing-indicator');
const userSearch = document.getElementById('user-search');

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
loadChats();

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
      <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
      <div>
        <div><strong>${chatName}</strong></div>
        <div style="font-size: 12px; color: #666;">${chat.latestMessage ? chat.latestMessage.text : 'No messages'}</div>
      </div>
    `;
    div.addEventListener('click', () => selectChat(chat));
    chatList.appendChild(div);
  });
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
      content += `<img src="http://localhost:5000${msg.fileUrl}" class="message-file-img">`;
    } else {
      content += `<a href="http://localhost:5000${msg.fileUrl}" target="_blank">📄 Download Attachment</a>`;
    }
  }

  div.innerHTML = content;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

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

// --- USER SEARCH & START CHAT ---
userSearch.addEventListener('input', async (e) => {
  const query = e.target.value.trim();
  if (!query) return renderChats();

  const users = await apiRequest(`/auth/users?search=${query}`);
  chatList.innerHTML = '';
  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `👤 ${u.username}`;
    div.addEventListener('click', async () => {
      const chat = await apiRequest('/chats', 'POST', { userId: u._id });
      if (!chats.find(c => c._id === chat._id)) chats.unshift(chat);
      userSearch.value = '';
      selectChat(chat);
    });
    chatList.appendChild(div);
  });
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
      if (!groupSelectedUsers.find(sel => sel._id === u._id)) {
        groupSelectedUsers.push(u);
        document.getElementById('group-selected-users').innerText = 
          'Selected: ' + groupSelectedUsers.map(s => s.username).join(', ');
      }
    });
    groupSearchResults.appendChild(div);
  });
});

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