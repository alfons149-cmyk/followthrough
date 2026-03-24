-- 0003_seed_users.sql

-- Zorg dat default workspace/user bestaan
INSERT OR IGNORE INTO workspaces (id, name)
VALUES ('ws_1', 'Default workspace');

INSERT OR IGNORE INTO users (id, workspace_id, email, display_name)
VALUES ('u_1', 'ws_1', 'default@example.com', 'Default user');
