/**
 * Chat Widget - Main Script
 */

(function () {
  "use strict";

  function loadSocketIO(callback) {
    if (window.io) {
      callback();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.socket.io/3.1.3/socket.io.min.js";
    script.integrity = 'sha384-cPwlPLvBTa3sKAgddT6krw0cJat7egBga3DJepJyrLl4Q9/5WLra3rrnMcyTyOnh'
    script.crossOrigin = "anonymous"; // use the version your backend expects
    script.onload = () => callback();
    script.onerror = () => console.error("Failed to load Socket.IO client.");
    document.head.appendChild(script);
  }

  // Configuration
  const API_BASE_URL = "https://staging.dispute.evoolv.com";
  const WS_URL = "wss://staging.dispute.evoolv.com/user";

  //create ticket endpoint route => /integrations/tickets

  class ChatWidget {
    constructor(config) {
      this.config = config;
      this.apiToken = config.apiToken;
      this.position = config.position || "bottom-right";
      this.isOpen = false;
      this.isChatStarted = false;
      this.widgetConfig = null;
      this.messages = [];
      this.ws = null;
      this.userId = this.getUserId();
      this.onboardingStep = 0; // 0: Off/Done, 1: FirstName, 2: LastName, 3: Email, 4: Issue
      this.userDetails = {
        firstName: "",
        lastName: "",
        email: "",
      };
      this.ticketInfo = {
        id: null,
        organizationId: null,
      };

      loadSocketIO(() => {
        this.init();
      });
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

        // Connect WebSocket
        this.connectSocket();

        this.loadStorage();
      } catch (error) {
        console.error("Chat Widget initialization failed:", error);
      }
    }


    loadStorage() {
      const userDetails = localStorage.getItem("chat-widget-user-details");
      const ticketInfo = localStorage.getItem("chat-widget-ticket-info");
      
      if (userDetails) {
        try {
          this.userDetails = JSON.parse(userDetails);
        } catch (e) {
          console.error("Failed to parse user details", e);
        }
      }

      if (ticketInfo) {
        try {
          this.ticketInfo = JSON.parse(ticketInfo);
        } catch (e) {
            console.error("Failed to parse ticket info", e);
        }
      }

      const storedMessages = localStorage.getItem("chat-widget-messages");
      if (storedMessages) {
        try {
          const parsedMessages = JSON.parse(storedMessages);
          if (parsedMessages.length > 0) {
            console.log(`Loading ${parsedMessages.length} messages from storage.`);
            this.isChatStarted = true;
            this.messages = parsedMessages;
            // Force first message to show date separator if needed
            let dateSeparatorAdded = false;
            this.messages.forEach((msg, index) => {
              if (!dateSeparatorAdded && msg.sender === 'user') {
                 this.addDateSeparator();
                 dateSeparatorAdded = true;
              }
              this.addMessage(msg.text, msg.sender, false, msg.timestamp); 
            });
          }
        } catch (e) {
          console.error("Failed to parse stored messages", e);
        } 
      }
    }

    getUserId() {
      let userId = localStorage.getItem("chat-widget-user-id");
      if (!userId) {
        userId = this.generateUUID();
        localStorage.setItem("chat-widget-user-id", userId);
      }
      return userId;
    }

    generateUUID() {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }
      );
    }

    connectSocket() {
      console.log(this.userId, "userid");
      const socketUserId = this.userId;
      try {
        this.ws = io(WS_URL, {
          path: "/ws",
          auth: {
            api_key: this.apiToken,
            user_id: socketUserId
          },
         
          extraHeaders: {
            user_id: socketUserId
          }
        });

        this.ws.on("connect", () => {
          console.log("Socket connected");
          if (this.ticketInfo.id) {
            this.ws.emit("join_room", { ticket_id: this.ticketInfo.id });
          }
        });
        this.ws.on("disconnect", () => console.log("Socket disconnected"));
        this.ws.on("connect_error", (err) =>
          console.error("Socket error:", err)
        );
        this.ws.on("receive_message", (data) => this.handleWebSocketMessage(data));
        this.ws.on("ticket_closed", () => {
          console.log("Ticket closed event received. Clearing storage.");
          this.ticketInfo = { id: null, organizationId: null };
          localStorage.removeItem("chat-widget-ticket-info");
          localStorage.removeItem("chat-widget-messages");
          this.messages = [];
          // Optionally reset view or show closing message
        });
      } catch (err) {
        console.error("Failed to connect socket:", err);
      }
    }

    handleWebSocketMessage(data) {
      // Remove typing indicator if exists
      this.removeTypingIndicator();

      // Handle different message types
      if (data.type === "message" || data.message) {
        const messageText = data.message || data.text || data.content;
        if (messageText) {
          this.addMessage(messageText, "bot");
        }
      } else if (data.type === "typing") {
        this.showTypingIndicator();
      }
    }

    async fetchWidgetConfig() {
      const response = await fetch(
        `${API_BASE_URL}/integrations/chat-widgets`,
        {
          headers: {
            apiKey: this.apiToken,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch widget configuration");
      }

      this.widgetConfig = await response.json();
    }

    createWidget() {
      // Create container
      const container = document.createElement("div");
      container.id = "chat-widget-container";
      container.className = `chat-widget-container ${this.position}`;

      // Create widget HTML with two views: front (welcome) and chat
      container.innerHTML = `
      <div id="chat-widget-button" class="chat-widget-button">
      <svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
      </svg>
  </div>
  
        
        <div id="chat-widget-window" class="chat-widget-window" style="display:none;">
          <!-- Header -->
          <div class="chat-widget-header">
            <h3 class="chat-widget-title">${
              this.widgetConfig?.name || "Chatbot Name"
            }</h3>
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
                ${
                  this.widgetConfig?.logoUrl
                    ? `<img src="${this.widgetConfig?.logoUrl}" alt="Logo" class="chat-logo-img"/>`
                    : `<svg class="chat-logo-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>`
                }
              </div>
              
              <div class="chat-welcome-text">
                <h3 class="chat-welcome-title">${
                  this.widgetConfig?.openingMessage ||
                  "Hi there 👋 how can we help?"
                }</h3>
                <p class="chat-welcome-subtitle">${
                  this.widgetConfig?.supportingMessage ||
                  "Our support team is online and ready to chat"
                }</p>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send-horizontal-icon lucide-send-horizontal"><path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/><path d="M6 12h16"/></svg>
              </button>
            </div>
            
            <div class="chat-widget-powered">
              <span class="powered-text">Powered by:</span>
              <img src="https://evoolv-upload-bucket.s3.amazonaws.com/57271314-b2a9-4d43-b297-cad6c4e958b4-small-logo.webp" alt="Evoolv logo" class="powered-logo-img"/>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(container);

      // Apply brand colors
      this.applyBrandColors();
    }

    applyBrandColors() {
      const button = document.getElementById("chat-widget-button");
      const header = document.querySelector(".chat-widget-header");
      const sendBtn = document.getElementById("chat-send-btn");

      if (this.widgetConfig?.brandColor) {
        const { primaryColor, bubbleColor } = this.widgetConfig?.brandColor;

        if (button) button.style.backgroundColor = primaryColor || "#4F46E5";
        if (header) header.style.backgroundColor = primaryColor || "#4F46E5";
        if (sendBtn) sendBtn.style.backgroundColor = primaryColor || "#4F46E5";

        // Apply bubble color to bot messages
        const style = document.createElement("style");
        style.textContent = `
          .bot-message .message-content {
            background-color: ${bubbleColor || "#FEF3C7"} !important;
            color: #1F2937 !important;
          }
        `;
        document.head.appendChild(style);
      }
    }

    attachEventListeners() {
      const button = document.getElementById("chat-widget-button");
      const closeBtn = document.getElementById("chat-close-btn");
      const sendBtn = document.getElementById("chat-send-btn");
      const input = document.getElementById("chat-input");

      button.addEventListener("click", () => this.toggleWidget());
      closeBtn.addEventListener("click", () => this.closeWidget());
      sendBtn.addEventListener("click", () => this.sendMessage());
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.sendMessage();
      });
    }

    toggleWidget() {
      this.isOpen = !this.isOpen;
      const widgetWindow = document.getElementById("chat-widget-window");
      const chatButton = document.getElementById("chat-widget-button");

      if (this.isOpen) {
        widgetWindow.style.display = "flex";
        chatButton.style.display = "none"; // hide main button

        if (!this.isChatStarted) {
          document.getElementById("chat-welcome-view").style.display = "flex";
          document.getElementById("chat-messages-view").style.display = "none";
        } else {
          document.getElementById("chat-welcome-view").style.display = "none";
          document.getElementById("chat-messages-view").style.display = "flex";
        }

        // Start onboarding if needed and not already started
        if (
          !this.userDetails.email &&
          this.onboardingStep === 0 &&
          !this.isChatStarted
        ) {
          this.isChatStarted = true; // Skip welcome screen for onboarding
          document.getElementById("chat-welcome-view").style.display = "none";
          document.getElementById("chat-messages-view").style.display = "flex";
          this.onboardingStep = 1;
          this.addMessage(
            "Hi there! 👋 To get started, could you please tell me your First Name?",
            "bot"
          );
          document.getElementById("chat-input").placeholder =
            "Enter your First Name...";
        }

        document.getElementById("chat-input").focus();
      } else {
        widgetWindow.style.display = "none";
        chatButton.style.display = "flex"; // show main button
      }
    }

    closeWidget() {
      this.isOpen = false;

      const widgetWindow = document.getElementById("chat-widget-window");
      const chatButton = document.getElementById("chat-widget-button");

      if (widgetWindow) widgetWindow.style.display = "none";
      if (chatButton) chatButton.style.display = "flex"; // show the button again
    }

    sendMessage() {
      const input = document.getElementById("chat-input");
      const message = input.value.trim();

      console.log(`sendMessage triggered with: "${message}"`);

      if (!message) return;

      // Handle onboarding flow
      if (this.onboardingStep > 0) {
        this.addMessage(message, "user");
        input.value = "";
        this.handleOnboarding(message);
        return;
      }

      // Check WebSocket connection
     
      // Switch to chat view if on welcome screen
      if (!this.isChatStarted) {
        this.isChatStarted = true;
        document.getElementById("chat-welcome-view").style.display = "none";
        document.getElementById("chat-messages-view").style.display = "flex";

        // Add date separator
        this.addDateSeparator();
      }

      // Add user message to UI
      this.addMessage(message, "user");
      input.value = "";

      // Send message via WebSocket
      try {
        if (this.ticketInfo.id) {
          this.ws.emit("join_room", { ticket_id: this.ticketInfo.id });
        }

        const payload = {
            message: message,
            senderId: this.userId,
            ticketId: this.ticketInfo.id,
            organizationId: this.ticketInfo.organizationId,
            attachments: [],
            createdAt: new Date().toISOString(),
        };

        this.ws.emit("send_message", payload);


      } catch (error) {
        console.error("Error sending message:", error);
        this.removeTypingIndicator();
        this.addMessage("Failed to send message. Please try again.", "bot", false);
      }
    }

    async handleOnboarding(text) {
      const input = document.getElementById("chat-input");

      switch (this.onboardingStep) {
        case 1: // First Name
          this.userDetails.firstName = text;
          this.onboardingStep = 2;
          this.showTypingIndicator();
          setTimeout(() => {
            this.removeTypingIndicator();
            this.addMessage(
              `Thanks ${this.userDetails.firstName}! What is your Last Name?`,
              "bot"
            );
            input.placeholder = "Enter your Last Name...";
          }, 600);
          break;

        case 2: // Last Name
          this.userDetails.lastName = text;
          this.onboardingStep = 3;
          this.showTypingIndicator();
          setTimeout(() => {
            this.removeTypingIndicator();
            this.addMessage("Great! And finally, what is your Email?", "bot");
            input.placeholder = "Enter your Email...";
          }, 600);
          break;

        case 3: // Email
          // Basic email validation could go here
          this.userDetails.email = text;
          localStorage.setItem(
            "chat-widget-user-details",
            JSON.stringify(this.userDetails)
          );
          this.onboardingStep = 4;
          this.showTypingIndicator();
          setTimeout(() => {
            this.removeTypingIndicator();
            this.addMessage(
              "Perfect. Now, how can we help you today?",
              "bot"
            );
            input.placeholder = "Describe what you need help with...";
          }, 600);
          break;

        case 4: // Issue Description & Create Ticket
          this.onboardingStep = 0; // Reset to normal chat
          input.placeholder = "Describe what you need help with..."; // Reset placeholder

          this.showTypingIndicator();
          
          try {
             const ticketResponse = await this.createTicket(text);
             this.removeTypingIndicator();
             const ticketData = ticketResponse.data;
             
             // Update ticket info
             this.ticketInfo = {
                 id: ticketData.id,
                 organizationId: ticketData.organizationId
             };
             localStorage.setItem("chat-widget-ticket-info", JSON.stringify(this.ticketInfo));

             // Verify connection before sending initial message
             if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                 // Attempt reconnect if needed, or queue message
                 console.log("Socket not open, ensuring connection...");
             }
             
             // Send the message via socket
             if (this.ticketInfo.id) {
               this.ws.emit("join_room", { ticket_id: this.ticketInfo.id });
             }

             const payload = {
                message: text,
                senderId: this.userId,
                ticketId: this.ticketInfo.id,
                organizationId: this.ticketInfo.organizationId,
                attachments: [],
                createdAt: new Date().toISOString(),
            };

              this.ws.emit("send_message", payload);
          } catch (error) {
              this.removeTypingIndicator();
              this.addMessage("Sorry, we encountered an error setting up your chat. Please try again.", "bot", false);
              console.error("Onboarding error:", error);
          }
          break;
      }
    }

    async createTicket(description) {
      const payload = {
        userId: this.userId,
        category: "support", // Default
        attachments: [],
        description: description,
        firstName: this.userDetails.firstName,
        lastName: this.userDetails.lastName,
        email: this.userDetails.email,
        isGuest: true,
      };

      try {
        const response = await fetch(`${API_BASE_URL}/integrations/tickets`, {
          method: "POST",
          headers: {
             "apiKey": this.apiToken,
             "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Ticket creation failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Ticket created:", data);
        return data; 
      } catch (error) {
        console.error("Failed to create ticket", error);
        throw error;
      }
    }

    addDateSeparator() {
      const messagesContainer = document.getElementById("chat-messages");
      const dateDiv = document.createElement("div");
      dateDiv.className = "chat-date-separator";

      const today = new Date();
      const options = { year: "numeric", month: "long", day: "numeric" };
      dateDiv.textContent = today.toLocaleDateString("en-US", options);

      messagesContainer.appendChild(dateDiv);
    }

    addMessage(text, sender, save = true, timestamp = null) {
      if (!text) return;
      const messagesContainer = document.getElementById("chat-messages");
      
      if (this.messages.length === 0 && sender === 'user') {
          this.addDateSeparator();
      }

      if (save) {
        this.messages.push({ 
          text, 
          sender, 
          timestamp: timestamp || new Date().toISOString() 
        });
        localStorage.setItem("chat-widget-messages", JSON.stringify(this.messages));
        console.log(`Message saved to storage (${sender}): ${text.substring(0, 20)}...`);
      }
      const messageDiv = document.createElement("div");
      messageDiv.className = `chat-message ${sender}-message`;

      const displayDate = timestamp ? new Date(timestamp) : new Date();
      const time = displayDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      if (sender === "bot") {
        messageDiv.innerHTML = `
          <div class="message-header">
            <div class="message-avatar">
              ${
                this.widgetConfig?.logoUrl
                  ? `<img src="${this.widgetConfig?.logoUrl}" alt="Agent"/>`
                  : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>`
              }
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
      // Don't add if already exists
      if (document.getElementById("typing-indicator")) return;

      const messagesContainer = document.getElementById("chat-messages");
      const typingDiv = document.createElement("div");
      typingDiv.className = "chat-message bot-message typing-indicator";
      typingDiv.id = "typing-indicator";
      typingDiv.innerHTML = `
        <div class="message-header">
          <div class="message-avatar">
            ${
              this.widgetConfig?.logoUrl
                ? `<img src="${this.widgetConfig?.logoUrl}" alt="Agent"/>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>`
            }
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
      const indicator = document.getElementById("typing-indicator");
      if (indicator) indicator.remove();
    }

    escapeHtml(text) {
      const div = document.createElement("div");
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
          bottom: 20px;
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
        
        .powered-logo-img {
          width: 20px;
          height: 20px;
          object-fit: contain;
        }
        
        @media (max-width: 768px) {
          .chat-widget-button {
            width: 64px;
            height: 64px;
          }
          
          .chat-widget-button svg {
            width: 32px;
            height: 32px;
          }
          
          .chat-widget-window {
            position: fixed;
            bottom: 0;
            right: 0;
            left: 0;
            width: 100%;
            height: 100%;
            max-height: 100vh;
            border-radius: 0;
          }
          
          .chat-widget-header {
            padding: 24px 20px;
          }
          
          .chat-widget-title {
            font-size: 20px;
          }
          
          .chat-widget-close-btn {
            width: 32px;
            height: 32px;
            padding: 8px;
          }
          
          .chat-widget-close-btn svg {
            width: 18px;
            height: 18px;
          }
          
          .chat-welcome-logo {
            width: 72px;
            height: 72px;
          }
          
          .chat-logo-img {
            width: 72px;
            height: 72px;
          }
          
          .chat-logo-placeholder {
            width: 32px;
            height: 32px;
          }
          
          .chat-welcome-title {
            font-size: 20px;
          }
          
          .chat-welcome-subtitle {
            font-size: 14px;
          }
          
          .chat-widget-messages {
            padding: 24px 16px;
          }
          
          .chat-message {
            margin-bottom: 20px;
          }
          
          .bot-message,
          .user-message {
            max-width: 85%;
          }
          
          .message-avatar {
            width: 32px;
            height: 32px;
          }
          
          .message-avatar svg {
            width: 16px;
            height: 16px;
          }
          
          .message-agent-name {
            font-size: 16px;
          }
          
          .message-time {
            font-size: 13px;
          }
          
          .message-content {
            padding: 14px 16px;
            font-size: 15px;
          }
          
          .message-status {
            font-size: 13px;
          }
          
          .chat-widget-footer {
            padding: 20px 16px 24px;
          }
          
          .chat-widget-input-container {
            gap: 12px;
            margin-bottom: 16px;
          }
          
          .chat-widget-input {
            padding: 14px 18px;
            font-size: 16px;
          }
          
          .chat-widget-send-btn {
            width: 52px;
            height: 52px;
          }
          
          .chat-widget-send-btn svg {
            width: 20px;
            height: 20px;
          }
          
          .chat-widget-powered {
            gap: 10px;
          }
          
          .powered-text {
            font-size: 14px;
          }
          
          .powered-logo-img {
            width: 24px;
            height: 24px;
          }
        }
      `;

      const styleEl = document.createElement("style");
      styleEl.textContent = styles;
      document.head.appendChild(styleEl);
    }
  }

  // Expose to window
  window.ChatWidget = ChatWidget;
})();
