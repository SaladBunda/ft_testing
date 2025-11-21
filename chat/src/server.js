"use strict";
import Fastify from "fastify";
import Websocket from "@fastify/websocket";
import crypto from "crypto";
import metricsPlugin from "../plugins/metrics/index.js";
import dbPlugin from "../plugins/db.js";
import config from "../config.js";

const PORT = Number(config.PORT) || 8006;

const fastify = Fastify();

const connectedUsers = new Map();

await fastify.register(Websocket);

await fastify.register(metricsPlugin);

await fastify.register(dbPlugin);

function sendPendingMessages(socket, userId, channelId, db) {
  try {
    const pendingMessages = db
      .prepare("SELECT * FROM messages WHERE channel_id = ? ORDER BY sent_at DESC LIMIT 15")
      .all(channelId);

    if (!pendingMessages.length) {
      console.log("no messages for ", userId);
      return;
    }

    for (const msg of pendingMessages.reverse()) {
      console.log("Sending pending message to user:", msg.content);
      socket.send(JSON.stringify(msg));
    }
  } catch (err) {
    console.error("Error fetching pending messages:", err);
  }
}

function storeMessage(msg, delivered, db) {
  console.log("message sender: ", msg.sender_id.toString());
  console.log("message receiver: ", msg.receiver_id != null ? msg.receiver_id.toString() : "null");
  console.log("message channel: ", msg.channel_id);
  console.log("message content: ", msg.content);
  console.log("message delivered: ", delivered);

  try {
    db.prepare(`
      INSERT INTO messages (id, sender_id, receiver_id, channel_id, content, sent_at, delivered)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      msg.sender_id.toString(),
      msg.receiver_id == null ? null : msg.receiver_id.toString(),
      msg.channel_id,
      msg.content,
      new Date().toISOString(),
      delivered
    );
    console.log("* stored successfully: ", msg.content);
  } catch (err) {
    console.log("channel not found: ", err);
  }
}

function getChannelMembers(channel_id, db) {
  const members = db.prepare("SELECT * FROM channel_members WHERE channel_id = ?").all(channel_id);
  if (!members || members.length === 0) {
    console.warn(`No members found for channel: ${channel_id}`);
    return [];
  }
  return members.map(member => member.user_id);
}

function sendToReceiver(message, db) {
  const receiverSocket = connectedUsers.get(message.receiver_id);
  const isOnline = receiverSocket && receiverSocket.readyState === 1;

  if (isOnline) {
    receiverSocket.send(JSON.stringify(message));
  }

  storeMessage(message, isOnline ? 1 : 0, db);
}

function sendToChannel(message, db) {
  const members = getChannelMembers(message.channel_id, db);
  for (const memberId of members) {
    if (memberId === message.sender_id.toString()) {
      continue;
    }
    if (!not_blocked(memberId, message.sender_id, db)) {
      console.log("user_id  ", memberId, "blocked the user ", message.sender_id);
      continue;
    }
    message.receiver_id = memberId;
    sendToReceiver(message, db);
  }
  message.receiver_id = null;
  storeMessage(message, 1, db);
}

function not_blocked(sender_id, receiver_id, db) {
  try {
    const blocked = db.prepare("SELECT * FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?").get(receiver_id, sender_id);
    return !blocked;
  } catch (err) {
    console.error("Error checking block status:", err);
    return false;
  }
}

function isPrivateChannel(channelId, db) {
  try {
    const channel = db.prepare("SELECT * FROM channels WHERE id = ? AND is_private = 1").get(channelId);
    if (!channel) {
      return false;
    }
    return true;
  } catch (err) {
    console.log("cannot find the channel");
    return false;
  }
}

fastify.get('/health', {
  schema: {
    tags: ['System'],
    summary: 'Health check',
    security: [],
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          service: { type: 'string' },
          version: { type: 'string' },
          timestamp: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => {
  return {
    status: 'ok',
    service: config.SERVICE_NAME,
    version: config.SERVICE_VERSION,
    timestamp: new Date().toISOString()
  };
}); 

fastify.get("/ws", { websocket: true }, (socket, req) => {
  console.warn("* CHAT: new client connected to websocket");
  const userId = req.query.userId;
  if (!userId) {
    console.warn("Missing userId in query params");
    socket.close();
    return;
  }
  connectedUsers.set(userId, socket);

  socket.on("message", (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString());
      if (msg.pending && msg.pending === 1) {
        sendPendingMessages(socket, userId, msg.channel_id, fastify.db);
        return;
      }
      if (isPrivateChannel(msg.channel_id, fastify.db)) {
        console.log("------------------------------- PRIVATE -----------------------------------");
        if (msg.receiver_id && not_blocked(msg.sender_id, msg.receiver_id, fastify.db)) {
          console.log("not blocked user");
          sendToReceiver(msg, fastify.db);
        } else if (msg.receiver_id && !not_blocked(msg.sender_id, msg.receiver_id, fastify.db)) {
          console.log("* PRIVATE CHANNEL: user_id  ", msg.receiver_id, "blocked the user ", msg.sender_id);
          socket.send(JSON.stringify({ error: "You are blocked by the user." })); 
        }
      } else {
        console.log("------------------------------- CHANNEL -----------------------------------");
        console.log("Group message to channel:", msg.channel_id);
        sendToChannel(msg, fastify.db);
      }
    } catch (err) {
      console.error("Error handling message:", err);
    }
  });

  socket.on("close", () => {
    console.log(`User disconnected: ${userId}`);
    connectedUsers.delete(userId);
  });
});

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    console.error("Error starting server:", err);
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Server running on port ${PORT}`);
});
