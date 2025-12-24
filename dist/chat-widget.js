/**
 * Chat Widget - Main Script
 */
(function () {
  'use strict';

  // =========================
  // Configuration
  // =========================
  const API_BASE_URL = 'https://staging.dispute.evoolv.com';
  const WS_URL = 'wss://staging.dispute.evoolv.com/user';

  class ChatWidget {
    constructor(config) {
      this.config = config || {};
      this.apiToken = config.apiToken;
      this.position = config.position || 'bottom-right';

      this.isOpen = false;
      this.isChatStarted = false;
      this.widgetConfig = null;
      this.ws = null;

      this.userId = this.getUserId();
      this.init();
    }

    // =========================
    // Init
    // =========================
    async init() {
      try {
        await this.fetchWidgetConfig();
        this.createWidget();
        this.attachEventListeners();
        this.injectStyles();
        this.connectWebSocket();
      } catch (err) {
        console.error('ChatWidget init failed:', err);
      }
    }

    // =========================
    // Utilities
    // =========================
    getUserId() {
      let id = localStorage.getItem('chat-widget-user-id');
      if (!id) {
        id = `guest_${this.uuid()}`;
        localStorage.setItem('chat-widget-user-id', id);
      }
      return id;
    }

    uuid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // =========================
    // API
    // =========================
    async fetchWidgetConfig() {
      const res = await fetch(`${API_BASE_URL}/organizations/chat-widgets`, {
        headers: {
          apiKey: this.apiToken,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) throw new Error('Widget config fetch failed');
      this.widgetConfig = await res.json();
    }

    // =========================
    // WebSocket
    // =========================
    connectWebSocket() {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({
          type: 'auth',
          api_key: this.apiToken,
          user_id: this.userId
        }));
      };

      this.ws.onmessage = e => {
        try {
          const data = JSON.parse(e.data);
          this.handleSocketMessage(data);
        } catch {
          console.warn('Invalid WS message');
        }
      };

      this.ws.onclose = () => {
        if (this.isOpen) {
          setTimeout(() => this.connectWebSocket(), 3000);
        }
      };
    }

    handleSocketMessage(data) {
      this.removeTypingIndicator();

      if (data.type === 'typing') {
        this.showTypingIndicator();
        return;
      }

      const text = data.message || data.text || data.content;
      if (text) this.addMessage(text, 'bot');
    }

    // =========================
    // UI Creation
    // =========================
    createWidget() {
      const el = document.createElement('div');
      el.id = 'chat-widget-container';
      el.className = `chat-widget-container ${this.position}`;

      el.innerHTML = `
        <div id="chat-widget-button" class="chat-widget-button">
          <span class="chat-icon">💬</span>
          <span class="close-icon" style="display:none">✖</span>
        </div>

        <div id="chat-widget-window" class="chat-widget-window" style="display:none">
          <div class="chat-widget-header">
            <h3>${this.widgetConfig.name || 'Chat Support'}</h3>
            <button id="chat-close-btn">✖</button>
          </div>

          <div id="chat-welcome-view" class="chat-welcome-view">
            <p>${this.widgetConfig.openingMessage || 'Hi 👋 How can we help?'}</p>
          </div>

          <div id="chat-messages-view" class="chat-messages-view" style="display:none">
            <div id="chat-messages" class="chat-widget-messages"></div>
          </div>

          <div class="chat-widget-footer">
            <input id="chat-input" placeholder="Type a message…" />
            <button id="chat-send-btn">➤</button>
          </div>
        </div>
      `;

      document.body.appendChild(el);
    }

    attachEventListeners() {
      document.getElementById('chat-widget-button')
        .addEventListener('click', () => this.toggleWidget());

      document.getElementById('chat-close-btn')
        .addEventListener('click', () => this.closeWidget());

      document.getElementById('chat-send-btn')
        .addEventListener('click', () => this.sendMessage());

      document.getElementById('chat-input')
        .addEventListener('keypress', e => {
          if (e.key === 'Enter') this.sendMessage();
        });
    }

    toggleWidget() {
      this.isOpen = !this.isOpen;
      const win = document.getElementById('chat-widget-window');
      const icon = document.querySelector('.chat-icon');
      const close = document.querySelector('.close-icon');

      win.style.display = this.isOpen ? 'flex' : 'none';
      icon.style.display = this.isOpen ? 'none' : 'block';
      close.style.display = this.isOpen ? 'block' : 'none';
    }

    closeWidget() {
      this.isOpen = false;
      document.getElementById('chat-widget-window').style.display = 'none';
    }

    // =========================
    // Messaging
    // =========================
    sendMessage() {
      const input = document.getElementById('chat-input');
      const msg = input.value.trim();
      if (!msg) return;

      if (!this.isChatStarted) {
        this.isChatStarted = true;
        document.getElementById('chat-welcome-view').style.display = 'none';
        document.getElementById('chat-messages-view').style.display = 'flex';
      }

      this.addMessage(msg, 'user');
      input.value = '';

      this.ws?.send(JSON.stringify({
        type: 'message',
        message: msg,
        userId: this.userId
      }));

      this.showTypingIndicator();
    }

    addMessage(text, sender) {
      const box = document.getElementById('chat-messages');
      const div = document.createElement('div');
      div.className = `chat-message ${sender}`;
      div.innerHTML = this.escapeHtml(text);
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    }

    showTypingIndicator() {
      if (document.getElementById('typing')) return;
      const div = document.createElement('div');
      div.id = 'typing';
      div.textContent = 'Typing…';
      document.getElementById('chat-messages').appendChild(div);
    }

    removeTypingIndicator() {
      document.getElementById('typing')?.remove();
    }

    // =========================
    // Styles
    // =========================
    injectStyles() {
      const css = `
        .chat-widget-container { position: fixed; z-index: 999999; font-family: sans-serif }
        .bottom-right { bottom: 20px; right: 20px }
        .chat-widget-button { width: 56px; height: 56px; border-radius: 50%; background:#4F46E5; color:#fff; display:flex;align-items:center;justify-content:center; cursor:pointer }
        .chat-widget-window { width:360px;height:520px;background:#fff;border-radius:12px;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,.2) }
        .chat-widget-header { padding:12px;background:#4F46E5;color:#fff;display:flex;justify-content:space-between }
        .chat-widget-messages { flex:1; padding:12px; overflow:auto }
        .chat-message.user { text-align:right; margin-bottom:8px }
        .chat-message.bot { text-align:left; margin-bottom:8px }
        .chat-widget-footer { padding:8px; display:flex; gap:8px }
        #chat-input { flex:1; padding:8px }
      `;
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  // 🔥 VERY IMPORTANT: expose globally
  window.ChatWidget = ChatWidget;

})();
