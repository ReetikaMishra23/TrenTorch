-- DSA sheet discussion: same shape as potd_discussion_comments (one comment
-- per solver per question, flat votes), minus the POTD "unlocked" time gate,
-- since DSA questions have no daily release schedule. Comments are visible to
-- any signed-in user as soon as they exist; posting still requires having
-- solved that question, recorded in solved_questions regardless of whether
-- that solve happened in POTD or DSA sheet context.

create function public.has_solved_dsa(u_id uuid, q_id text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.solved_questions sq
    where sq.user_id = u_id and sq.question_id = q_id
  );
$$;

revoke execute on function public.has_solved_dsa(uuid, text) from public, anon;
grant execute on function public.has_solved_dsa(uuid, text) to authenticated;

create table public.dsa_discussion_comments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id text not null,
  content     text not null check (char_length(content) between 1 and 2000),
  upvotes     int4 not null default 0,
  downvotes   int4 not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint one_dsa_comment_per_user_per_question unique (user_id, question_id)
);

create index dsa_discussion_comments_question_idx
  on public.dsa_discussion_comments (question_id);

alter table public.dsa_discussion_comments enable row level security;

revoke all on public.dsa_discussion_comments from anon, authenticated;
grant select on public.dsa_discussion_comments to authenticated;
grant insert (question_id, content) on public.dsa_discussion_comments to authenticated;
grant update (content) on public.dsa_discussion_comments to authenticated;
grant delete on public.dsa_discussion_comments to authenticated;

create policy "Anyone signed in can view DSA comments"
  on public.dsa_discussion_comments for select
  to authenticated
  using (true);

create policy "Solvers can post their DSA comment"
  on public.dsa_discussion_comments for insert
  to authenticated
  with check (auth.uid() = user_id and public.has_solved_dsa(auth.uid(), question_id));

create policy "Authors can edit their own DSA comment"
  on public.dsa_discussion_comments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Authors can delete their own DSA comment"
  on public.dsa_discussion_comments for delete
  to authenticated
  using (auth.uid() = user_id);

create function public.validate_dsa_comment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  body text := replace(new.content, E'\r', '');
  body_without_fenced_blocks text;
  blk  text;
  line text;
  run  int := 0;
  code_lines int := 0;
  max_block constant int := 6;
  max_lines constant int := 30;
begin
  if (select count(*) from regexp_split_to_table(body, E'\n')) > max_lines then
    raise exception 'dsa_comment_too_many_lines' using errcode = 'check_violation';
  end if;

  for blk in
    select m[2] from regexp_matches(body, E'(```|~~~)[^\\n]*\\n(.*?)(?:\\1|$)', 'gs') as m
  loop
    code_lines := code_lines + (
      select count(*) from regexp_split_to_table(blk, E'\n') l where btrim(l) <> ''
    );
    if code_lines > max_block then
      raise exception 'dsa_comment_code_block_too_long' using errcode = 'check_violation';
    end if;
  end loop;

  body_without_fenced_blocks :=
    regexp_replace(body, E'(```|~~~)[^\\n]*\\n.*?(?:\\1|$)', '', 'gs');
  for line in select * from regexp_split_to_table(body_without_fenced_blocks, E'\n') loop
    if line ~ E'^(    |\\t)' and btrim(line) <> '' then
      run := run + 1;
      code_lines := code_lines + 1;
      if code_lines > max_block then
        raise exception 'dsa_comment_code_block_too_long' using errcode = 'check_violation';
      end if;
    else
      run := 0;
    end if;
  end loop;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_dsa_comment() from public, anon, authenticated;

create trigger validate_dsa_comment
  before insert or update of content on public.dsa_discussion_comments
  for each row execute function public.validate_dsa_comment();

create table public.dsa_comment_votes (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  comment_id uuid not null references public.dsa_discussion_comments (id) on delete cascade,
  vote_value int2 not null check (vote_value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

alter table public.dsa_comment_votes enable row level security;

revoke all on public.dsa_comment_votes from anon, authenticated;
grant select on public.dsa_comment_votes to authenticated;
grant insert (comment_id, vote_value) on public.dsa_comment_votes to authenticated;
grant update (vote_value) on public.dsa_comment_votes to authenticated;
grant delete on public.dsa_comment_votes to authenticated;

create policy "Users can view their own DSA votes"
  on public.dsa_comment_votes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can vote on DSA comments that are not their own"
  on public.dsa_comment_votes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.dsa_discussion_comments c
      where c.id = comment_id and c.user_id <> auth.uid()
    )
  );

create policy "Users can change their own DSA vote"
  on public.dsa_comment_votes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can retract their own DSA vote"
  on public.dsa_comment_votes for delete
  to authenticated
  using (auth.uid() = user_id);

create function public.apply_dsa_vote_delta()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  du int := 0;
  dd int := 0;
  target uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old.vote_value = 1 then du := du - 1; else dd := dd - 1; end if;
    target := old.comment_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if new.vote_value = 1 then du := du + 1; else dd := dd + 1; end if;
    target := new.comment_id;
  end if;

  update public.dsa_discussion_comments
     set upvotes = upvotes + du, downvotes = downvotes + dd
   where id = target;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke execute on function public.apply_dsa_vote_delta() from public, anon, authenticated;

create trigger apply_dsa_vote_delta
  after insert or update of vote_value or delete on public.dsa_comment_votes
  for each row execute function public.apply_dsa_vote_delta();

create function public.get_dsa_discussion_state(p_question_id text)
returns table (solved boolean, has_commented boolean)
language sql
stable
set search_path = ''
as $$
  select
    public.has_solved_dsa(auth.uid(), p_question_id),
    exists (
      select 1 from public.dsa_discussion_comments c
      where c.question_id = p_question_id and c.user_id = auth.uid()
    );
$$;

create function public.get_dsa_comments(p_question_id text)
returns table (
  id uuid,
  content text,
  upvotes int4,
  downvotes int4,
  created_at timestamptz,
  updated_at timestamptz,
  is_mine boolean,
  my_vote int2,
  author_username text,
  author_display_name text
)
language sql
stable
security definer set search_path = ''
as $$
  select
    c.id, c.content, c.upvotes, c.downvotes, c.created_at, c.updated_at,
    (c.user_id = auth.uid()),
    v.vote_value,
    case when p.is_public then p.username end,
    case when p.is_public then p.display_name end
  from public.dsa_discussion_comments c
  left join public.profiles p on p.id = c.user_id
  left join public.dsa_comment_votes v
    on v.comment_id = c.id and v.user_id = auth.uid()
  where auth.uid() is not null
    and c.question_id = p_question_id
  order by (c.upvotes - c.downvotes) desc, c.created_at asc
  limit 200;
$$;

revoke execute on function public.get_dsa_discussion_state(text) from public, anon;
revoke execute on function public.get_dsa_comments(text) from public, anon;
grant execute on function public.get_dsa_discussion_state(text) to authenticated;
grant execute on function public.get_dsa_comments(text) to authenticated;
