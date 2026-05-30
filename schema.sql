-- COMPLETE, FRESH SCHEMA FOR CIPHERX
-- Drops all existing tables to start fresh (WARNING: This will delete existing data)
drop table if exists public.messages cascade;
drop table if exists public.conversation_participants cascade;
drop table if exists public.conversations cascade;
drop table if exists public.user_settings cascade;
drop table if exists public.contacts cascade;
drop table if exists public.profiles cascade;
drop function if exists public.handle_new_user cascade;
drop function if exists public.handle_new_user_settings cascade;
drop function if exists public.is_admin cascade;
drop function if exists public.is_approved cascade;
drop function if exists public.is_conversation_participant cascade;

-- 1. Profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  username text unique,
  display_name text,
  avatar_url text,
  rsa_public_key text,
  role text default 'user' check (role in ('admin', 'user')),
  status text default 'pending' check (status in ('pending', 'approved')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. User Settings table (Includes rsa_private_key)
create table public.user_settings (
  user_id uuid references auth.users on delete cascade not null primary key,
  default_algorithm text default 'caesar',
  default_shift text default '3',
  show_visualization boolean default false,
  quick_visualization boolean default true,
  show_advanced_dashboard boolean default true,
  theme text default 'cyber',
  rsa_private_key text
);

-- 3. Contacts table
create table public.contacts (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references auth.users on delete cascade not null,
  addressee_id uuid references auth.users on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (requester_id, addressee_id)
);

-- 4. Conversations table
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Conversation Participants table
create table public.conversation_participants (
  conversation_id uuid references public.conversations on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  primary key (conversation_id, user_id)
);

-- 6. Messages table
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations on delete cascade,
  sender_id uuid references auth.users on delete cascade not null,
  ciphertext text not null,
  algorithm_used text not null,
  shift_key text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- TRIGGERS --

-- Handle new user signup
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

-- Handle new user settings
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


-- SECURITY DEFINER FUNCTIONS (Prevents Infinite Recursion) --

create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create function public.is_approved()
returns boolean
language sql
security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'approved');
$$;

create function public.is_conversation_participant(co_id uuid)
returns boolean
language sql
security definer set search_path = public
as $$
  select exists(select 1 from public.conversation_participants where conversation_id = co_id and user_id = auth.uid());
$$;


-- ROW LEVEL SECURITY (RLS) POLICIES --

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Profiles: Anyone can view. Users can update their own. Admins can update all.
create policy "Users can view all profiles" on public.profiles for select using (true);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);
create policy "Admins can update all profiles" on public.profiles for update using (public.is_admin());

-- User Settings: Users can view, insert, and update their own.
create policy "Users can view own settings" on public.user_settings for select using (auth.uid() = user_id);
create policy "Users can update own settings" on public.user_settings for update using (auth.uid() = user_id);
create policy "Users can insert own settings" on public.user_settings for insert with check (auth.uid() = user_id);

-- Contacts: Users can view contacts they are part of. Users can insert contacts if they are the requester. Users can update if they are the addressee (to approve/reject). Admins can view/update all.
create policy "Users can view their contacts" on public.contacts for select using (auth.uid() = requester_id or auth.uid() = addressee_id or public.is_admin());
create policy "Users can insert contacts" on public.contacts for insert with check (auth.uid() = requester_id);
create policy "Users can update their received contacts" on public.contacts for update using (auth.uid() = addressee_id or public.is_admin());

-- Conversations: Users can view conversations they are in.
create policy "Users can view conversations they are in" on public.conversations for select using (
  public.is_conversation_participant(id)
);
create policy "Users can insert conversations" on public.conversations for insert with check (true);

-- Conversation Participants: Users can view participants of their conversations.
create policy "Users can view participants in their conversations" on public.conversation_participants for select using (
  public.is_conversation_participant(conversation_id)
);
create policy "Users can insert participants" on public.conversation_participants for insert with check (true);

-- Messages: Users can view messages in their conversations. Approved users can insert messages.
create policy "Users can view messages" on public.messages for select using (
  conversation_id is null or public.is_conversation_participant(conversation_id)
);
create policy "Approved users can insert messages" on public.messages for insert with check (
  public.is_approved() and (conversation_id is null or public.is_conversation_participant(conversation_id))
);

-- ENABLE REALTIME --
drop publication if exists supabase_realtime;
create publication supabase_realtime;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.contacts;


-- PERFORMANCE INDEXES --
-- To ensure smooth and efficient data retrieval when many devices are using the app
create index if not exists idx_contacts_addressee_id on public.contacts(addressee_id);
create index if not exists idx_conv_participants_user_id on public.conversation_participants(user_id);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_created_at on public.messages(created_at desc);
