/**
 * Chat Widget - Main Script
 */

(function() {
  'use strict';

  // Configuration
  const API_BASE_URL = 'https://staging.dispute.evoolv.com/';
  
  class ChatWidget {
    constructor(config) {
      this.config = config;
      this.apiToken = config.apiToken;
      this.position = config.position || 'bottom-right';
      this.isOpen = false;
      this.isChatStarted = false;
      this.widgetConfig = null;
      this.messages = [];
      
      this.init();
    }

    async init() {
      try {
        // Fetch widget configuration from backend
        await this.fetchWidgetConfig();
        
        // Create widget elements
        this.createWidget();
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Add CSS styles
        this.injectStyles();
      } catch (error) {
        console.error('Chat Widget initialization failed:', error);
      }
    }

    async fetchWidgetConfig() {
      const response = await fetch(`${API_BASE_URL}organizations/chat-widgets`, {
        headers: {
          'apiKey': this.apiToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch widget configuration');
      }

      this.widgetConfig = await response.json();
    }

    createWidget() {
      // Create container
      const container = document.createElement('div');
      container.id = 'chat-widget-container';
      container.className = `chat-widget-container ${this.position}`;
      
      // Create widget HTML with two views: front (welcome) and chat
      container.innerHTML = `
        <div id="chat-widget-button" class="chat-widget-button">
          <svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
          </svg>
          <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="display:none;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
        
        <div id="chat-widget-window" class="chat-widget-window" style="display:none;">
          <!-- Header -->
          <div class="chat-widget-header">
            <h3 class="chat-widget-title">${this.widgetConfig.name || 'Chatbot Name'}</h3>
            <button class="chat-widget-close-btn" id="chat-close-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <!-- Welcome View -->
          <div id="chat-welcome-view" class="chat-welcome-view">
            <div class="chat-welcome-content">
              <div class="chat-welcome-logo">
                ${this.widgetConfig.logoUrl ? 
                  `<img src="${this.widgetConfig.logoUrl}" alt="Logo" class="chat-logo-img"/>` : 
                  `<svg class="chat-logo-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>`}
              </div>
              
              <div class="chat-welcome-text">
                <h3 class="chat-welcome-title">${this.widgetConfig.openingMessage || 'Hi there 👋 how can we help?'}</h3>
                <p class="chat-welcome-subtitle">${this.widgetConfig.supportingMessage || 'Our support team is online and ready to chat'}</p>
              </div>
            </div>
          </div>
          
          <!-- Chat View -->
          <div id="chat-messages-view" class="chat-messages-view" style="display:none;">
            <div class="chat-widget-messages" id="chat-messages"></div>
          </div>
          
          <!-- Footer with Input -->
          <div class="chat-widget-footer">
            <div class="chat-widget-input-container">
              <input 
                type="text" 
                id="chat-input" 
                class="chat-widget-input" 
                placeholder="Describe what you need help with…"
                autocomplete="off"
              />
              <button class="chat-widget-send-btn" id="chat-send-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </button>
            </div>
            
            <div class="chat-widget-powered">
              <span class="powered-text">Powered by:</span>
              <img src="https://evoolv-upload-bucket.s3.amazonaws.com/57271314-b2a9-4d43-b297-cad6c4e958b4-small-logo.webp" alt="Evoolv logo"/>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(container);
      
      // Apply brand colors
      this.applyBrandColors();
    }

    applyBrandColors() {
      const button = document.getElementById('chat-widget-button');
      const header = document.querySelector('.chat-widget-header');
      const sendBtn = document.getElementById('chat-send-btn');
      
      if (this.widgetConfig.brandColor) {
        const { primaryColor, bubbleColor } = this.widgetConfig.brandColor;
        
        if (button) button.style.backgroundColor = primaryColor || '#4F46E5';
        if (header) header.style.backgroundColor = primaryColor || '#4F46E5';
        if (sendBtn) sendBtn.style.backgroundColor = primaryColor || '#4F46E5';
        
        // Apply bubble color to bot messages
        const style = document.createElement('style');
        style.textContent = `
          .bot-message .message-content {
            background-color: ${bubbleColor || '#FEF3C7'} !important;
            color: #1F2937 !important;
          }
        `;
        document.head.appendChild(style);
      }
    }

    attachEventListeners() {
      const button = document.getElementById('chat-widget-button');
      const closeBtn = document.getElementById('chat-close-btn');
      const sendBtn = document.getElementById('chat-send-btn');
      const input = document.getElementById('chat-input');

      button.addEventListener('click', () => this.toggleWidget());
      closeBtn.addEventListener('click', () => this.closeWidget());
      sendBtn.addEventListener('click', () => this.sendMessage());
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sendMessage();
      });
    }

    toggleWidget() {
      this.isOpen = !this.isOpen;
      const window = document.getElementById('chat-widget-window');
      const chatIcon = document.querySelector('.chat-icon');
      const closeIcon = document.querySelector('.close-icon');
      
      if (this.isOpen) {
        window.style.display = 'flex';
        chatIcon.style.display = 'none';
        closeIcon.style.display = 'block';
        
        if (!this.isChatStarted) {
          // Show welcome view
          document.getElementById('chat-welcome-view').style.display = 'flex';
          document.getElementById('chat-messages-view').style.display = 'none';
        } else {
          // Show chat view
          document.getElementById('chat-welcome-view').style.display = 'none';
          document.getElementById('chat-messages-view').style.display = 'flex';
        }
        
        document.getElementById('chat-input').focus();
      } else {
        window.style.display = 'none';
        chatIcon.style.display = 'block';
        closeIcon.style.display = 'none';
      }
    }

    closeWidget() {
      this.isOpen = false;
      document.getElementById('chat-widget-window').style.display = 'none';
      document.querySelector('.chat-icon').style.display = 'block';
      document.querySelector('.close-icon').style.display = 'none';
    }

    async sendMessage() {
      const input = document.getElementById('chat-input');
      const message = input.value.trim();
      
      if (!message) return;
      
      // Switch to chat view if on welcome screen
      if (!this.isChatStarted) {
        this.isChatStarted = true;
        document.getElementById('chat-welcome-view').style.display = 'none';
        document.getElementById('chat-messages-view').style.display = 'flex';
        
        // Add date separator
        this.addDateSeparator();
      }
      
      // Add user message to UI
      this.addMessage(message, 'user');
      input.value = '';
      
      // Show typing indicator
      this.showTypingIndicator();
      
      try {
        // Send message to backend
        const response = await fetch(`${API_BASE_URL}/chat/message`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: message,
            conversationId: this.getConversationId()
          })
        });
        
        const data = await response.json();
        
        // Remove typing indicator
        this.removeTypingIndicator();
        
        // Add bot response
        this.addMessage(data.message, 'bot');
        
      } catch (error) {
        this.removeTypingIndicator();
        this.addMessage('Sorry, something went wrong. Please try again.', 'bot');
        console.error('Error sending message:', error);
      }
    }

    addDateSeparator() {
      const messagesContainer = document.getElementById('chat-messages');
      const dateDiv = document.createElement('div');
      dateDiv.className = 'chat-date-separator';
      
      const today = new Date();
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      dateDiv.textContent = today.toLocaleDateString('en-US', options);
      
      messagesContainer.appendChild(dateDiv);
    }

    addMessage(text, sender) {
      const messagesContainer = document.getElementById('chat-messages');
      const messageDiv = document.createElement('div');
      messageDiv.className = `chat-message ${sender}-message`;
      
      const time = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      
      if (sender === 'bot') {
        messageDiv.innerHTML = `
          <div class="message-header">
            <div class="message-avatar">
              ${this.widgetConfig.logoUrl ? 
                `<img src="${this.widgetConfig.logoUrl}" alt="Agent"/>` : 
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>`}
            </div>
            <span class="message-agent-name">Agent</span>
            <span class="message-time">${time}</span>
          </div>
          <div class="message-content">${this.escapeHtml(text)}</div>
        `;
      } else {
        messageDiv.innerHTML = `
          <div class="message-content">${this.escapeHtml(text)}</div>
          <div class="message-status">Seen - ${time}</div>
        `;
      }
      
      messagesContainer.appendChild(messageDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showTypingIndicator() {
      const messagesContainer = document.getElementById('chat-messages');
      const typingDiv = document.createElement('div');
      typingDiv.className = 'chat-message bot-message typing-indicator';
      typingDiv.id = 'typing-indicator';
      typingDiv.innerHTML = `
        <div class="message-header">
          <div class="message-avatar">
            ${this.widgetConfig.logoUrl ? 
              `<img src="${this.widgetConfig.logoUrl}" alt="Agent"/>` : 
              `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>`}
          </div>
          <span class="message-agent-name">Agent</span>
        </div>
        <div class="message-content typing-dots">
          <span></span><span></span><span></span>
        </div>
      `;
      messagesContainer.appendChild(typingDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    removeTypingIndicator() {
      const indicator = document.getElementById('typing-indicator');
      if (indicator) indicator.remove();
    }

    getConversationId() {
      let conversationId = localStorage.getItem('chat-widget-conversation-id');
      if (!conversationId) {
        conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('chat-widget-conversation-id', conversationId);
      }
      return conversationId;
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    injectStyles() {
      const styles = `
        * { box-sizing: border-box; }
        
        #chat-widget-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: fixed;
          z-index: 999999;
        }
        
        #chat-widget-container.bottom-right {
          bottom: 20px;
          right: 20px;
        }
        
        #chat-widget-container.bottom-left {
          bottom: 20px;
          left: 20px;
        }
        
        .chat-widget-button {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background-color: #4F46E5;
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: all 0.3s ease;
        }
        
        .chat-widget-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        }
        
        .chat-widget-button svg {
          width: 28px;
          height: 28px;
        }
        
        .chat-widget-window {
          position: absolute;
          bottom: 80px;
          right: 0;
          width: 400px;
          height: 660px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15);
          border: 1px solid rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .chat-widget-header {
          background-color: #4F46E5;
          color: white;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .chat-widget-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        
        .chat-widget-close-btn {
          background: white;
          border: none;
          color: #1F2937;
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          transition: background-color 0.2s;
        }
        
        .chat-widget-close-btn:hover {
          background-color: #f3f4f6;
        }
        
        .chat-widget-close-btn svg {
          width: 16px;
          height: 16px;
        }
        
        /* Welcome View */
        .chat-welcome-view {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          overflow-y: auto;
        }
        
        .chat-welcome-content {
          max-width: 90%;
          text-align: center;
        }
        
        .chat-welcome-logo {
          width: 56px;
          height: 56px;
          margin: 0 auto 24px;
          background-color: #f3f4f6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .chat-logo-img {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .chat-logo-placeholder {
          width: 24px;
          height: 24px;
          color: #9ca3af;
        }
        
        .chat-welcome-text {
          margin-top: 24px;
        }
        
        .chat-welcome-title {
          font-size: 18px;
          font-weight: 600;
          color: #1F2937;
          margin: 0 0 8px 0;
        }
        
        .chat-welcome-subtitle {
          font-size: 12px;
          color: #6b7280;
          margin: 0;
        }
        
        /* Chat Messages View */
        .chat-messages-view {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .chat-widget-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: white;
        }
        
        .chat-date-separator {
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          margin: 16px 0;
        }
        
        .chat-message {
          margin-bottom: 16px;
        }
        
        .bot-message {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          max-width: 320px;
        }
        
        .user-message {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          margin-left: auto;
          max-width: 320px;
        }
        
        .message-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        
        .message-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        
        .message-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .message-avatar svg {
          width: 12px;
          height: 12px;
          color: #9ca3af;
        }
        
        .message-agent-name {
          font-size: 14px;
          font-weight: 600;
          color: #1F2937;
        }
        
        .message-time {
          font-size: 12px;
          color: #9ca3af;
        }
        
        .message-content {
          padding: 12px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          word-wrap: break-word;
        }
        
        .bot-message .message-content {
          background-color: #FEF3C7;
          color: #1F2937;
          border-bottom-left-radius: 4px;
        }
        
        .user-message .message-content {
          background-color: #EEF2FF;
          color: #1F2937;
          border-bottom-right-radius: 4px;
        }
        
        .message-status {
          font-size: 12px;
          color: #d1d5db;
          margin-top: 4px;
        }
        
        .typing-indicator .message-content {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 12px 16px;
        }
        
        .typing-dots {
          display: flex;
          gap: 4px;
        }
        
        .typing-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #9ca3af;
          animation: typing 1.4s infinite;
        }
        
        .typing-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .typing-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes typing {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
        
        /* Footer */
        .chat-widget-footer {
          background: white;
          padding: 20px;
          border-top: 1px solid #f3f4f6;
        }
        
        .chat-widget-input-container {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }
        
        .chat-widget-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 40px;
          font-size: 14px;
          outline: none;
          background-color: #f9fafb;
        }
        
        .chat-widget-input:focus {
          border-color: #4F46E5;
          background-color: white;
        }
        
        .chat-widget-send-btn {
          width: 44px;
          height: 44px;
          background-color: #4F46E5;
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background-color 0.2s;
        }
        
        .chat-widget-send-btn:hover {
          background-color: #4338CA;
        }
        
        .chat-widget-send-btn svg {
          width: 16px;
          height: 16px;
        }
        
        .chat-widget-powered {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .powered-text {
          font-size: 12px;
          color: #4F46E5;
        }
        
        .powered-logo {
          width: 20px;
          height: 20px;
          color: #4F46E5;
        }
      `;
      
      const styleSheet = document.createElement('style');
      styleSheet.textContent = styles;
      document.head.appendChild(styleSheet);
    }
  }

  // Initialize the widget when called
  window.ChatWidget = function(command, config) {
    if (command === 'init') {
      new ChatWidget(config);
    }
  };
  
  // Process any queued commands
  if (window.ChatWidget.q) {
    window.ChatWidget.q.forEach(function(args) {
      window.ChatWidget.apply(null, args);
    });
  }
})();


