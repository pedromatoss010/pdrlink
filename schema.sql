-- Criação da tabela de usuários (com dados de perfil integrados)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    bio VARCHAR(300),
    account_type VARCHAR(50) DEFAULT 'pessoa',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    avatar_url VARCHAR(255),
    accepted_terms_at TIMESTAMP WITH TIME ZONE,
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo'
);

-- Índices para garantir unicidade e busca rápida ignorando maiúsculas/minúsculas
CREATE UNIQUE INDEX idx_users_username_lower ON users (LOWER(username));
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));

-- Criação da tabela de links
CREATE TABLE links (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    url VARCHAR(255) NOT NULL,
    position INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    icon_url VARCHAR(255)
);

-- Índice para acelerar a busca e ordenação de links por usuário
CREATE INDEX idx_links_user_id ON links(user_id);

-- Criação da tabela de horários de funcionamento
CREATE TABLE business_hours (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    open_time TIME,
    close_time TIME,
    closed BOOLEAN DEFAULT false,
    
    -- Restrição que permite o UPSERT (ON CONFLICT)
    CONSTRAINT unique_user_day UNIQUE (user_id, day_of_week)
);