-- Drop existing objects if they exist
drop table if exists public.messages cascade;
drop table if exists public.conversation_participants cascade;
drop table if exists public.conversations cascade;
drop table if exists public.user_settings cascade;
drop table if exists public.profiles cascade;
drop function if exists public.handle_new_user cascade;
drop function if exists public.handle_new_user_settings cascade;

-- Profiles table
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  username text unique,
  avatar_url text,
  role text default 'user' check (role in ('admin', 'user')),
  status text default 'pending' check (status in ('pending', 'approved')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Handle new user signup via trigger
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, role, status)
  values (new.id, new.email, split_part(new.email, '@', 1), 'user', 'pending');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Conversations
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Conversation Participants
create table public.conversation_participants (
  conversation_id uuid references public.conversations on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  primary key (conversation_id, user_id)
);

-- Messages
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations on delete cascade,
  sender_id uuid references auth.users not null,
  ciphertext text not null,
  algorithm_used text not null,
  shift_key text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User Settings
create table public.user_settings (
  user_id uuid references auth.users not null primary key,
  default_algorithm text default 'caesar',
  default_shift text default '3',
  show_visualization boolean default true,
  quick_visualization boolean default true,
  show_advanced_dashboard boolean default true,
  theme text default 'cyber'
);

-- Trigger for default settings
create function public.handle_new_user_settings()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_settings
  after insert on auth.users
  for each row execute procedure public.handle_new_user_settings();

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.user_settings enable row level security;

-- Add RLS Policies
create policy "Users can view all profiles" on public.profiles for select using (true);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

-- ONLY admins can update role or status of any profile
create policy "Admins can update all profiles" on public.profiles for update using (
  exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
);

create policy "Users can view conversations they are in" on public.conversations for select using (
  exists (
    select 1 from public.conversation_participants
    where conversation_id = conversations.id and user_id = auth.uid()
  )
);
create policy "Users can insert conversations" on public.conversations for insert with check (true);

create or replace function public.is_conversation_participant(co_id uuid, u_id uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = co_id and user_id = u_id
  );
$$;

create policy "Users can view participants in their conversations" on public.conversation_participants for select using (
  public.is_conversation_participant(conversation_id, auth.uid())
);
create policy "Users can insert participants" on public.conversation_participants for insert with check (true);

-- Allow viewing global messages or messages in conversations
create policy "Users can view messages" on public.messages for select using (
  conversation_id is null or
  exists (
    select 1 from public.conversation_participants
    where conversation_id = messages.conversation_id and user_id = auth.uid()
  )
);
-- Allow inserting global messages ONLY IF user is approved
create policy "Approved users can insert messages" on public.messages for insert with check (
  exists (
    select 1 from public.profiles where id = auth.uid() and status = 'approved'
  )
  and (
    conversation_id is null or
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  )
);

create policy "Users can view own settings" on public.user_settings for select using (auth.uid() = user_id);
create policy "Users can update own settings" on public.user_settings for update using (auth.uid() = user_id);
create policy "Users can insert own settings" on public.user_settings for insert with check (auth.uid() = user_id);
