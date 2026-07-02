-- Database schema for Dynamic Tournament Bracket Generator
-- Execute this SQL in your Supabase SQL Editor

-- 1. Tournaments Table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'completed'
    admin_code VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Teams Table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Matches Table
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL, -- 1, 2, 3, etc.
    match_order INTEGER NOT NULL,  -- Vertical order in the round (1, 2, 3...)
    team1_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    team2_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    score1 INTEGER,
    score2 INTEGER,
    penalty1 INTEGER,
    penalty2 INTEGER,
    next_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    next_match_slot INTEGER, -- 1 for team1_id, 2 for team2_id
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable Supabase Realtime for instant updates on bracket changes
-- Note: In Supabase, the publication 'supabase_realtime' is created by default.
-- We add our tables to it to enable real-time subscriptions.
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
