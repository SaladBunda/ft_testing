// chatSchema.js
const initializeChatSchema = (db) => {
    return new Promise((resolve, reject) => {
        console.log('💬 Initializing chat database schema...');

        // Ensure foreign keys are enabled
        db.run('PRAGMA foreign_keys = ON', (err) => {
            if (err) return reject(err);

            // Create tables sequentially
            db.run(`
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    channel_id TEXT,
                    sender_id TEXT NOT NULL,
                    receiver_id TEXT,
                    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    content TEXT NOT NULL,
                    delivered INTEGER DEFAULT 0,
                    FOREIGN KEY(channel_id) REFERENCES channels(id),
                    FOREIGN KEY(sender_id) REFERENCES users(id),
                    FOREIGN KEY(receiver_id) REFERENCES users(id)
                )
            `, (err) => {
                if (err) return reject(err);
                    db.run(`
                        CREATE TABLE IF NOT EXISTS channel_members (
                        channel_id  TEXT NOT NULL,
                        user_id     TEXT NOT NULL,
                        role        TEXT NOT NULL CHECK(role IN ('owner','admin','member')),
                        joined_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (channel_id, user_id),
                        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                    `, (err) => {
                        if (err) return reject(err);

                        db.run(`
                            CREATE TABLE IF NOT EXISTS blocked_users (
                                id TEXT PRIMARY KEY,
                                user_id TEXT NOT NULL,
                                blocked_user_id TEXT NOT NULL,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY(user_id) REFERENCES users(id),
                                FOREIGN KEY(blocked_user_id) REFERENCES users(id),
                                UNIQUE(user_id, blocked_user_id)
                            )
                        `, (err) => {

                            if (err) return reject(err);

                            db.run(`
                                CREATE TABLE IF NOT EXISTS friendships (
                                    id TEXT PRIMARY KEY,
                                    user_id TEXT NOT NULL,
                                    friend_id TEXT NOT NULL,
                                    status TEXT CHECK(status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
                                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                    FOREIGN KEY(user_id) REFERENCES Users(id),
                                    FOREIGN KEY(friend_id) REFERENCES Users(id)
                                )
                        `, (err) => {
                            if (err) return reject(err);

                            db.run(`
                                CREATE TABLE IF NOT EXISTS channels (
                                    id            TEXT PRIMARY KEY,
                                    name          TEXT,
                                    is_private    INTEGER NOT NULL DEFAULT 0,           
                                    description   TEXT,
                                    created_by    TEXT NOT NULL,
                                    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  
                                    last_message_id TEXT,
                                    avatar          TEXT,
                                    FOREIGN KEY (created_by) REFERENCES users(id),
                                    FOREIGN KEY (last_message_id) REFERENCES messages(id)
                                )`, (err) => {
                                if (err) return reject(err);

                                const indexes = [
                                'CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id)',
                                'CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)',
                                'CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id)',
                                'CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id)',
                                'CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id)',
                                'CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id)',
                                'CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id)'
                            ];

                            let i = 0;
                            const createNextIndex = () => {
                                if (i >= indexes.length) {
                                    console.log('✅ Chat database schema initialized successfully');
                                    resolve();
                                    return;
                                }

                                db.run(indexes[i], (err) => {
                                    if (err) return reject(err);
                                    i++;
                                    createNextIndex();
                                });
                            };

                            createNextIndex();
                              });

                            // Create indexes for optimization
                            db.serialize(() => {
                                const indexes = [
                                    'CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id)',
                                    'CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)',
                                    'CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id)',
                                    'CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id)',
                                    'CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id)',
                                    'CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id)',
                                    'CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id)'
                                ];

                                let i = 0;
                                const createNextIndex = () => {
                                    if (i >= indexes.length) {
                                        console.log('✅ Chat database schema initialized successfully');
                                        resolve();
                                        return;
                                    }

                                    db.run(indexes[i], (err) => {
                                        if (err) return reject(err);
                                        i++;
                                        createNextIndex();
                                    });
                                };

                                createNextIndex();
                            });
                        });
                            })

                       
                    });
                });
            // });
        });
    });
};

module.exports = { initializeChatSchema };
