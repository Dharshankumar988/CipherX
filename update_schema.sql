-- Run this in your Supabase SQL Editor to update your database schema

-- 1. Add display_name and avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Create contacts table for user-to-user approvals
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references public.profiles(id) on delete cascade not null,
  addressee_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(requester_id, addressee_id)
);

-- 3. Enable RLS and add policies for contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
CREATE POLICY "Users can view their own contacts" ON public.contacts
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users can insert contact requests" ON public.contacts;
CREATE POLICY "Users can insert contact requests" ON public.contacts
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Users can update contacts addressed to them" ON public.contacts;
CREATE POLICY "Users can update contacts addressed to them" ON public.contacts
  FOR UPDATE USING (auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;
CREATE POLICY "Users can delete their own contacts" ON public.contacts
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- 4. Add RSA key columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rsa_public_key text;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS rsa_private_key text;

-- 5. Allow users to delete their own sent messages
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);

-- 6. Enable Realtime on messages table so both users receive live updates
-- Run this to make sure Supabase Realtime broadcasts INSERT/UPDATE/DELETE on messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 7. Also enable Realtime on contacts so pending requests appear live
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;

-- 8. Fix infinite recursion in conversation_participants policy
CREATE OR REPLACE FUNCTION public.is_conversation_participant(co_id uuid, u_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = co_id AND user_id = u_id
  );
$$;

DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants in their conversations" ON public.conversation_participants
  FOR SELECT USING (public.is_conversation_participant(conversation_id, auth.uid()));

