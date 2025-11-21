

module.exports = async function (fastify) {

fastify.get('/conversations/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {

    const { id } = req.params;

    try {
        const channels = fastify.db.prepare(`
        SELECT
            c.id,
            c.name,
            c.is_private,
            c.description,
            c.created_by,
            c.created_at,
            c.updated_at,
            c.last_message_id,
            c.avatar,
            m.id AS last_message_id,
            m.content AS last_message_content,
            m.sender_id AS last_message_sender,
            m.sent_at AS last_message_time
        FROM Channels c
        JOIN channel_members cm ON cm.channel_id = c.id
        LEFT JOIN messages m ON c.last_message_id = m.id
        WHERE cm.user_id = ?
        ORDER BY m.sent_at DESC
    `).all(id);
        if(!channels) {
            console.log("* ERROR: channels are empty");
            return reply.send([]);
        }

        console.log("all channels: ", channels);
        
        return reply.send(channels);
        } catch (err) {
            console.error(err);
            return reply.status(500).send({ error: 'Failed to fetch conversations' });
        }
    });

    // const res = await fetch(`http://localhost:${userMgntPort}/channel/${channelId}/members`, {
    fastify.get('/channel/:id/members', async (req, reply) => {
        const { id } = req.params;

        try {
          const members = fastify.db
          .prepare(`SELECT user_id FROM channel_members WHERE channel_id = ?`)
          .all(id);

          return members.map(m => m.user_id);
        } catch (err) {
          console.error(err);
          return reply.status(500).send({ error: 'Failed to fetch channel members' });
        }

    });
    
};