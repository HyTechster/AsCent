-- ============================================================================
-- 05_leaderboard.sql — public top-scores read
-- ----------------------------------------------------------------------------
-- Ranks by net_worth (the score). Exposes ONLY display_name, the prestige rank
-- title, net_worth, and level — never user_id or email. SECURITY DEFINER so it
-- can read across all players' rows (which RLS otherwise hides), but returns
-- only those harmless columns. Granted to anon too, so logged-out visitors see it.
-- ============================================================================

-- Drop first: the return columns changed, and Postgres won't let
-- `create or replace` change a function's OUT columns.
drop function if exists get_leaderboard(int);

create or replace function get_leaderboard(p_limit int default 10)
returns table (
  rank_pos     bigint,   -- 1, 2, 3, ... by net worth
  display_name text,
  rank_name    text,     -- prestige title (Rakyat ... Bilionair)
  net_worth    numeric,
  level        int,
  is_me        boolean   -- true only for the caller's own row (no id leaked)
)
language sql
security definer
set search_path = public
as $$
  select
    row_number() over (order by ps.net_worth desc, ps.user_id) as rank_pos,
    pr.display_name,
    r.name as rank_name,
    ps.net_worth,
    ps.level,
    (ps.user_id = auth.uid()) as is_me   -- null/false for anon; no user_id exposed
  from player_state ps
  join profiles pr on pr.user_id = ps.user_id
  left join ranks r on r.id = ps.rank_id
  order by ps.net_worth desc, ps.user_id     -- stable tiebreak = same order as row_number
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

grant execute on function get_leaderboard(int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_my_rank(): the caller's own standing across ALL players, so the UI can
-- show "you are #26" under the top 10 even when they're off the visible list.
-- Same numbering (row_number by net worth) as get_leaderboard, so the position
-- lines up. Authenticated only — there is no "me" for a logged-out visitor.
-- ---------------------------------------------------------------------------
drop function if exists get_my_rank();

create or replace function get_my_rank()
returns table (
  rank_pos     bigint,
  display_name text,
  rank_name    text,
  net_worth    numeric,
  level        int
)
language sql
security definer
set search_path = public
as $$
  with ranked as (
    select
      ps.user_id,
      row_number() over (order by ps.net_worth desc, ps.user_id) as rank_pos,
      pr.display_name,
      r.name as rank_name,
      ps.net_worth,
      ps.level
    from player_state ps
    join profiles pr on pr.user_id = ps.user_id
    left join ranks r on r.id = ps.rank_id
  )
  select rank_pos, display_name, rank_name, net_worth, level
  from ranked
  where user_id = auth.uid();
$$;

grant execute on function get_my_rank() to authenticated;
