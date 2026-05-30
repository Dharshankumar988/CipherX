import React, { useState, useEffect, useRef } from 'react';
import { ScreenContainer } from '../components/ScreenContainer';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Search, UserPlus, UserMinus, Check, X, Send, Lock, Trash2, ArrowLeft } from 'lucide-react';
import { EncryptionVisualizer } from '../components/EncryptionVisualizer';
import { encryptCaesar, decryptCaesar } from '../lib/ciphers/caesar';
import { encryptAES, decryptAES } from '../lib/ciphers/aes';
import { encryptRSA, decryptRSA } from '../lib/ciphers/rsa';

const decryptMessage = (msg: any, currentUserId: string, myPrivateKey?: string) => {
  const algo = msg.algorithm_used;
  const key = msg.shift_key;
  if (algo === 'caesar') return decryptCaesar(msg.ciphertext, parseInt(key) || 3);
  if (algo === 'aes') return decryptAES(msg.ciphertext, key || 'secret');
  if (algo === 'rsa') {
    if (!myPrivateKey) return '[RSA Decryption Failed: No private key found. Generate RSA keys in Settings]';
    try {
      const parsed = JSON.parse(msg.ciphertext);
      const isSender = msg.sender_id === currentUserId;
      const cipherToDecrypt = isSender ? parsed.sender : parsed.recipient;
      if (!cipherToDecrypt) return '[RSA Decryption Failed: Missing payload]';
      return decryptRSA(cipherToDecrypt, myPrivateKey);
    } catch (e) {
      return '[RSA Decryption Failed: Invalid RSA payload format]';
    }
  }
  return 'Unsupported cipher';
};

type Contact = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'approved' | 'rejected';
  other_user: any; // populated manually
};

export const Dashboard: React.FC = () => {
  const { session, profile } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  
  const [messages, setMessages] = useState<any[]>([]);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  const [userSettings, setUserSettings] = useState<any>(null);
  
  // Visualizer state
  const [visActive, setVisActive] = useState(false);
  const [visEncrypting, setVisEncrypting] = useState(true);
  const [visOrig, setVisOrig] = useState('');
  const [visProc, setVisProc] = useState('');
  const [visKey, setVisKey] = useState('');
  const [visAlgo, setVisAlgo] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const globalChannelRef = useRef<any>(null);

  useEffect(() => {
    if (session?.user.id) {
      fetchContacts();
      fetchSettings();
      fetchUnreadCounts();
      setupGlobalMessageListener();
      setActiveContact(null);
      setMessages([]);
      setConversationId(null);
    }
  }, [session?.user.id]);

  useEffect(() => {
    const handleVisibilityAndFocus = () => {
      if (document.visibilityState === 'visible' && session?.user.id) {
        fetchUnreadCounts();
      }
    };
    
    window.addEventListener('focus', handleVisibilityAndFocus);
    document.addEventListener('visibilitychange', handleVisibilityAndFocus);
    
    return () => {
      window.removeEventListener('focus', handleVisibilityAndFocus);
      document.removeEventListener('visibilitychange', handleVisibilityAndFocus);
    };
  }, [session?.user.id]);

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (globalChannelRef.current) supabase.removeChannel(globalChannelRef.current);
    };
  }, []);

  const fetchUnreadCounts = async () => {
    if (!session?.user.id) return;
    const { data } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('is_read', false)
      .neq('sender_id', session.user.id);
      
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach(msg => {
        counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
  };

  const setupGlobalMessageListener = () => {
    if (globalChannelRef.current) supabase.removeChannel(globalChannelRef.current);
    
    globalChannelRef.current = supabase.channel('global_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as any;
        if (session?.user.id && msg.sender_id !== session.user.id) {
          if (activeContactRef.current !== msg.sender_id) {
            setUnreadCounts(prev => ({
              ...prev,
              [msg.sender_id]: (prev[msg.sender_id] || 0) + 1
            }));
          } else {
            // If the chat is open, immediately mark the newly arrived message as read in the background
            supabase.from('messages').update({ is_read: true }).eq('id', msg.id).then();
          }
        }
      })
      .subscribe();
  };

  const markAsRead = async (cid: string) => {
    if (!session?.user.id) return;
    await supabase.from('messages')
      .update({ is_read: true })
      .eq('conversation_id', cid)
      .neq('sender_id', session.user.id)
      .eq('is_read', false);
      
    if (activeContactRef.current) {
      const currentRefId = activeContactRef.current;
      setUnreadCounts(prev => ({ ...prev, [currentRefId]: 0 }));
    }
  };

  const fetchSettings = async () => {
    if (!session?.user.id) return;
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', session.user.id).single();
    if (data) setUserSettings(data);
  };

  const fetchContacts = async () => {
    if (!session?.user.id) return;
    
    // 1. Fetch contacts
    const { data: contactsData } = await supabase.from('contacts').select('*');
    if (!contactsData) return;
    
    // 2. Extract unique profile IDs needed
    const profileIds = new Set<string>();
    contactsData.forEach(c => {
      profileIds.add(c.requester_id);
      profileIds.add(c.addressee_id);
    });
    
    // 3. Fetch related profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, username, display_name, avatar_url, rsa_public_key')
      .in('id', Array.from(profileIds));
      
    if (!profilesData) return;
    
    // 4. Map them together manually since we can't join on auth.users foreign key directly
    const formatted = contactsData.map((c: any) => {
      const requester = profilesData.find(p => p.id === c.requester_id);
      const addressee = profilesData.find(p => p.id === c.addressee_id);
      return {
        ...c,
        requester,
        addressee,
        other_user: c.requester_id === session.user.id ? addressee : requester
      };
    }).filter((c: any) => c.requester && c.addressee);
    
    // 5. Deduplicate: if both users sent requests to each other, keep only
    //    the approved one (or the first one if neither is approved).
    const seen = new Map<string, any>();
    for (const c of formatted) {
      const otherId = c.other_user.id;
      const existing = seen.get(otherId);
      if (!existing || (c.status === 'approved' && existing.status !== 'approved')) {
        seen.set(otherId, c);
      }
    }
    
    setContacts(Array.from(seen.values()));
  };

  const handleSearch = async (term?: string) => {
    const searchEmail = typeof term === 'string' ? term : searchInputRef.current?.value || '';
    if (!searchEmail.trim() || !session?.user.id) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`email.ilike.%${searchEmail}%,display_name.ilike.%${searchEmail}%,username.ilike.%${searchEmail}%`)
      .neq('id', session.user.id)
      .limit(10);
      
    if (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } else {
      setSearchResults(data || []);
    }
    setHasSearched(true);
  };

  const sendRequest = async (targetUserId: string) => {
    if (!session?.user.id) return;
    await supabase.from('contacts').insert({
      requester_id: session.user.id,
      addressee_id: targetUserId,
      status: 'pending'
    });
    fetchContacts();
  };

  const severContact = async (contact: Contact) => {
    if (!session?.user.id) return;
    await supabase.from('contacts').update({
      status: 'pending',
      requester_id: contact.other_user.id,
      addressee_id: session.user.id
    }).eq('id', contact.id);
    setActiveContact(null);
    fetchContacts();
  };

  const activeContactRef = useRef<string | null>(null);

  // Chat logic
  useEffect(() => {
    if (activeContact && activeContact.status === 'approved') {
      if (activeContactRef.current !== activeContact.other_user.id) {
        activeContactRef.current = activeContact.other_user.id;
        loadConversation();
      }
    } else {
      activeContactRef.current = null;
      setMessages([]);
      setConversationId(null);
    }
  }, [activeContact]);

  const loadConversation = async () => {
    if (!activeContact || !session?.user.id) return;
    
    // Ensure settings are loaded
    let currentSettings = userSettings;
    if (!currentSettings) {
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', session.user.id).single();
      if (data) {
        setUserSettings(data);
        currentSettings = data;
      }
    }
    
    // Find shared conversation
    const { data: myParticipants } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', session.user.id);
    const { data: theirParticipants } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', activeContact.other_user.id);
    
    if (myParticipants && theirParticipants) {
      const myIds = myParticipants.map(p => p.conversation_id);
      const shared = theirParticipants.find(p => myIds.includes(p.conversation_id));
      
      if (shared) {
        setConversationId(shared.conversation_id);
        fetchMessages(shared.conversation_id, currentSettings);
        subscribeMessages(shared.conversation_id, currentSettings);
        markAsRead(shared.conversation_id);
        return;
      }
    }
    setConversationId(null);
    setMessages([]);
  };

  const fetchMessages = async (cid: string, settings = userSettings) => {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', cid).order('created_at', { ascending: true });
    if (data) {
      // Decrypt messages locally
      const decrypted = data.map(msg => ({
        ...msg,
        plaintext: decryptMessage(msg, session?.user.id || '', settings?.rsa_private_key)
      }));
      setMessages(decrypted);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const subscribeMessages = (cid: string, settings = userSettings) => {
    // Unsubscribe from previous channel if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`messages:${cid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${cid}` }, payload => {
        const msg = payload.new as any;
        const plaintext = decryptMessage(msg, session?.user.id || '', settings?.rsa_private_key);
        
        if (msg.sender_id !== session?.user.id && settings?.show_visualization) {
          let visOrigText = msg.ciphertext;
          if (msg.algorithm_used === 'rsa') {
            try {
              const parsed = JSON.parse(msg.ciphertext);
              visOrigText = parsed.recipient.substring(0, 40) + '...';
            } catch {}
          }
          setVisOrig(visOrigText);
          setVisProc(plaintext);
          
          let k = msg.shift_key;
          if (msg.algorithm_used === 'rsa') k = '[Private RSA Key]';
          setVisKey(k || '');
          setVisAlgo(msg.algorithm_used || 'caesar');
          
          setVisEncrypting(false);
          setVisActive(true);
          setTimeout(() => setVisActive(false), 2000);
        }

        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, { ...msg, plaintext }];
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${cid}` }, payload => {
        const deletedId = (payload.old as any).id;
        setMessages(prev => prev.filter(m => m.id !== deletedId));
      })
      .subscribe();

    channelRef.current = channel;
  };

  const sendMessage = async () => {
    const inputText = chatInputRef.current?.value || '';
    if (!inputText.trim() || !activeContact || !session?.user.id) return;
    
    if (chatInputRef.current) chatInputRef.current.value = '';
    
    let cid = conversationId;
    
    // Create conversation if it doesn't exist
    if (!cid) {
      const newCid = crypto.randomUUID();
      const { error: convErr } = await supabase.from('conversations').insert({ id: newCid });
      if (convErr) {
        console.error('Conversation creation error:', convErr);
        alert(`Failed to create conversation: ${convErr?.message || 'Unknown error'}`);
        return;
      }
      cid = newCid;
      const { error: partErr } = await supabase.from('conversation_participants').insert([
        { conversation_id: newCid, user_id: session.user.id },
        { conversation_id: newCid, user_id: activeContact.other_user.id }
      ]);
      if (partErr) {
        console.error('Participant insert error:', partErr);
        alert(`Failed to set up conversation: ${partErr.message}`);
        return;
      }
      setConversationId(newCid);
      subscribeMessages(newCid, userSettings);
    }
    
    if (!cid) return;

    const algo = userSettings?.default_algorithm || 'caesar';
    const shift = userSettings?.default_shift || '3';
    
    let ciphertext = '';
    if (algo === 'caesar') {
      ciphertext = encryptCaesar(inputText, parseInt(shift) || 3);
    } else if (algo === 'aes') {
      ciphertext = encryptAES(inputText, shift || 'secret');
    } else if (algo === 'rsa') {
      const recipientPubKey = activeContact.other_user.rsa_public_key;
      const senderPubKey = profile?.rsa_public_key;
      
      if (!recipientPubKey) {
        alert(`${activeContact.other_user.display_name || activeContact.other_user.username} has not generated RSA keys. RSA encryption is not possible.`);
        return;
      }
      if (!senderPubKey) {
        alert('You have not generated RSA keys. Please go to Settings to generate RSA keys.');
        return;
      }
      
      try {
        const encryptedRecipient = encryptRSA(inputText, recipientPubKey);
        const encryptedSender = encryptRSA(inputText, senderPubKey);
        ciphertext = JSON.stringify({
          recipient: encryptedRecipient,
          sender: encryptedSender
        });
      } catch (e) {
        console.error(e);
        alert('RSA encryption failed.');
        return;
      }
    } else {
      ciphertext = `[ENCRYPTED:${inputText}]`;
    }
    
    if (userSettings?.show_visualization) {
      setVisOrig(inputText);
      let visProcText = ciphertext;
      let k = shift;
      if (algo === 'rsa') {
        try {
          const parsed = JSON.parse(ciphertext);
          visProcText = parsed.recipient.substring(0, 40) + '...';
        } catch {}
        k = '[Public RSA Key]';
      }
      setVisProc(visProcText);
      setVisKey(k || '');
      setVisAlgo(algo);
      setVisEncrypting(true);
      setVisActive(true);
      setTimeout(() => setVisActive(false), 2000);
    }

    const { data: inserted, error: insertError } = await supabase.from('messages').insert({
      conversation_id: cid as string,
      sender_id: session.user.id,
      ciphertext,
      algorithm_used: algo,
      shift_key: algo === 'rsa' ? null : shift
    }).select().single();

    if (insertError) {
      console.error('Message insert error:', insertError);
      alert(`Failed to send message: ${insertError.message}`);
      return;
    }

    // Add to local state immediately so the message shows up right away
    if (inserted) {
      const plaintext = inputText;
      setMessages(prev => {
        // Avoid duplicates from realtime subscription
        if (prev.some(m => m.id === inserted.id)) return prev;
        return [...prev, { ...inserted, plaintext }];
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }

    if (chatInputRef.current) chatInputRef.current.value = '';
  };

  const deleteMessage = async (msgId: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', msgId);
    if (error) {
      console.error('Delete message error:', error);
      alert(`Failed to delete message: ${error.message}`);
      return;
    }
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  return (
    <ScreenContainer showSidebar={true} padded={false}>
      <div className="flex h-full w-full">
        {/* Sidebar */}
        <div className={`w-full md:w-80 border-r border-cyber-secondary/20 flex-col bg-cyber-bg/50 ${activeContact ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-cyber-secondary/20">
            <h2 className="text-xl font-bold text-cyber-text tracking-wide mb-4">CONTACTS</h2>
            <div className="flex space-x-2">
              <input 
                type="text" 
                className="w-full bg-cyber-bg border border-cyber-secondary/30 text-cyber-text pl-10 p-2 rounded focus:border-cyber-accent focus:outline-none text-sm"
                placeholder="Search username or email..."
                ref={searchInputRef}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.trim().length === 0) {
                    setSearchResults([]);
                    setHasSearched(false);
                    return;
                  }
                  if ((window as any).searchTimeout) clearTimeout((window as any).searchTimeout);
                  (window as any).searchTimeout = setTimeout(() => handleSearch(val), 300);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={() => handleSearch()} className="bg-cyber-secondary/20 p-2 rounded text-cyber-text hover:text-cyber-neon"><Search size={18}/></button>
            </div>
            
            {hasSearched && (
              <div className="mt-4 p-3 bg-cyber-card rounded border border-cyber-secondary/30 max-h-60 overflow-y-auto space-y-3">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-cyber-secondary text-center">No users found.</p>
                ) : (
                  searchResults.map(user => {
                    const contact = contacts.find(c => c.other_user.id === user.id);
                    return (
                      <div key={user.id} className="flex justify-between items-center pb-2 border-b border-cyber-secondary/10 last:border-b-0 last:pb-0">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-sm font-bold text-cyber-text truncate">{user.display_name || user.username}</p>
                          <p className="text-xs text-cyber-secondary truncate">{user.email}</p>
                        </div>
                        {contact ? (
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${contact.status === 'approved' ? 'text-cyber-neon bg-cyber-neon/10' : 'text-yellow-500 bg-yellow-500/10'}`}>
                            {contact.status}
                          </span>
                        ) : (
                          <button 
                            onClick={() => sendRequest(user.id)} 
                            className="text-cyber-neon hover:text-white p-1 hover:bg-cyber-neon/10 rounded transition-colors"
                            title="Add Contact"
                          >
                            <UserPlus size={16}/>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Pending Requests (Incoming) */}
            {contacts.filter(c => c.status === 'pending' && c.addressee_id === session?.user.id).length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-cyber-secondary uppercase mb-2">Pending Requests</h3>
                <div className="space-y-2">
                  {contacts.filter(c => c.status === 'pending' && c.addressee_id === session?.user.id).map(c => (
                    <div key={c.id} className="bg-cyber-card p-3 rounded flex justify-between items-center border border-yellow-500/30">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-cyber-bg flex-shrink-0 border border-yellow-500/40 overflow-hidden flex items-center justify-center">
                          {c.other_user.avatar_url ? (
                            <img src={c.other_user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-yellow-500 font-bold">{(c.other_user.display_name || c.other_user.username).substring(0,2).toUpperCase()}</span>
                          )}
                        </div>
                        <p className="text-sm text-cyber-text font-bold">{c.other_user.display_name || c.other_user.username}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button onClick={() => updateContactStatus(c.id, 'approved')} className="text-cyber-neon hover:text-white"><Check size={16}/></button>
                        <button onClick={() => updateContactStatus(c.id, 'rejected')} className="text-red-500 hover:text-white"><X size={16}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Approved Contacts */}
            <div>
              <h3 className="text-xs font-bold text-cyber-secondary uppercase mb-2">Secure Contacts</h3>
              <div className="space-y-1">
                {contacts.filter(c => c.status === 'approved').map(c => {
                  const unread = unreadCounts[c.other_user.id] || 0;
                  return (
                    <div 
                      key={c.id}
                      className={`w-full group p-2 md:p-3 rounded transition-colors flex items-center justify-between ${activeContact?.id === c.id ? 'bg-cyber-neon/10 border-l-2 border-cyber-neon' : 'hover:bg-cyber-secondary/10'}`}
                    >
                      <button 
                        onClick={() => setActiveContact(c)}
                        className="flex-1 flex items-center space-x-3 text-left min-w-0"
                      >
                        <div className="w-9 h-9 rounded-full bg-cyber-card flex-shrink-0 border border-cyber-secondary/30 overflow-hidden flex items-center justify-center relative">
                          {c.other_user.avatar_url ? (
                            <img src={c.other_user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-cyber-neon font-bold">{(c.other_user.display_name || c.other_user.username).substring(0,2).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm truncate ${unread > 0 ? 'font-bold text-white' : 'font-bold text-cyber-text'}`}>{c.other_user.display_name || c.other_user.username}</p>
                          <p className={`text-xs truncate ${unread > 0 ? 'text-cyber-neon font-bold' : 'text-cyber-secondary'}`}>
                            {unread > 0 ? 'New encrypted message' : 'Secure channel active'}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center space-x-2 pl-2">
                        {unread > 0 && (
                          <div className="w-5 h-5 rounded-full bg-cyber-neon text-cyber-bg flex items-center justify-center text-[10px] font-bold shadow-[0_0_8px_rgba(0,255,157,0.6)]">
                            {unread > 9 ? '9+' : unread}
                          </div>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Sever this conversation? It will be moved to your Pending Requests where you can restore it later.')) {
                              severContact(c);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-cyber-secondary hover:text-red-500 transition-all p-1"
                          title="Sever Conversation"
                        >
                          <UserMinus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
             {/* Pending Outgoing */}
             {contacts.filter(c => c.status === 'pending' && c.requester_id === session?.user.id).length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-cyber-secondary uppercase mb-2">Sent Requests</h3>
                <div className="space-y-2">
                  {contacts.filter(c => c.status === 'pending' && c.requester_id === session?.user.id).map(c => (
                    <div key={c.id} className="bg-cyber-card p-2 rounded flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-cyber-bg flex-shrink-0 border border-cyber-secondary/30 overflow-hidden flex items-center justify-center">
                          {c.other_user.avatar_url ? (
                            <img src={c.other_user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[8px] text-cyber-secondary font-bold">{(c.other_user.display_name || c.other_user.username).substring(0,2).toUpperCase()}</span>
                          )}
                        </div>
                        <p className="text-xs text-cyber-secondary">{c.other_user.display_name || c.other_user.username}</p>
                      </div>
                      <span className="text-[10px] text-yellow-500 uppercase">Waiting</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex-col bg-cyber-bg relative ${!activeContact ? 'hidden md:flex' : 'flex'}`}>
          {activeContact ? (
            <>
              {/* Chat Header */}
              <div className="h-16 border-b border-cyber-secondary/20 flex items-center justify-between px-6 bg-cyber-card/50">
                <div className="flex items-center space-x-3">
                  <button onClick={() => setActiveContact(null)} className="md:hidden text-cyber-neon hover:text-white mr-2">
                    <ArrowLeft size={24} />
                  </button>
                  {activeContact.other_user.avatar_url ? (
                    <img src={activeContact.other_user.avatar_url} alt="avatar" className="w-10 h-10 rounded-full object-cover border border-cyber-secondary/30 hidden md:block" />
                  ) : (
                    <Lock className="text-cyber-neon hidden md:block" size={20} />
                  )}
                  <div>
                    <h2 className="text-cyber-text font-bold">{activeContact.other_user.display_name || activeContact.other_user.username}</h2>
                    <p className="text-[10px] text-cyber-neon uppercase tracking-widest">End-to-End Encrypted</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (window.confirm('Sever this conversation? It will be moved to your Pending Requests where you can restore it later.')) {
                      severContact(activeContact);
                    }
                  }}
                  className="text-cyber-secondary hover:text-red-500 transition-colors p-2 rounded hover:bg-red-500/10"
                  title="Sever Conversation"
                >
                  <UserMinus size={18} />
                </button>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {activeContact.status !== 'approved' ? (
                  <div className="h-full flex items-center justify-center text-cyber-secondary flex-col space-y-4">
                    <Lock size={48} className="opacity-20" />
                    <p>Channel is pending approval. Waiting for {activeContact.other_user.display_name || activeContact.other_user.username} to accept.</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-cyber-secondary flex-col space-y-4">
                    <Lock size={48} className="opacity-20" />
                    <p>Secure channel established. Send a message to initiate.</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMine = msg.sender_id === session?.user.id;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group items-end space-x-2 mb-2`}>
                        {!isMine && (
                          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-cyber-card flex-shrink-0 border border-cyber-secondary/30 overflow-hidden flex items-center justify-center mb-1">
                            {activeContact.other_user.avatar_url ? (
                              <img src={activeContact.other_user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] text-cyber-secondary font-bold">{(activeContact.other_user.display_name || activeContact.other_user.username).substring(0,2).toUpperCase()}</span>
                            )}
                          </div>
                        )}
                        <div className={`max-w-[70%] p-3 md:p-4 rounded-xl relative ${isMine ? 'bg-cyber-neon/10 border border-cyber-neon/30 text-cyber-text rounded-br-none' : 'bg-cyber-card border border-cyber-secondary/20 text-cyber-text rounded-bl-none'}`}>
                          {isMine && (
                            <button
                              onClick={() => deleteMessage(msg.id)}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                              title="Delete message"
                            >
                              <Trash2 size={10} className="text-white" />
                            </button>
                          )}
                          <p className="text-sm">{msg.plaintext}</p>
                          <div className="flex justify-between items-center mt-2 space-x-4">
                            <span className="text-[9px] text-cyber-secondary font-mono">{msg.algorithm_used}</span>
                            <span className="text-[9px] text-cyber-secondary opacity-50">{new Date(msg.created_at).toLocaleTimeString()}</span>
                          </div>
                        </div>
                        {isMine && (
                          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-cyber-card flex-shrink-0 border border-cyber-neon/50 overflow-hidden flex items-center justify-center mb-1">
                            {profile?.avatar_url ? (
                              <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] text-cyber-neon font-bold">{(profile?.display_name || profile?.username || '?').substring(0,2).toUpperCase()}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input Area */}
              <div className="p-4 border-t border-cyber-secondary/20 bg-cyber-card/50">
                <div className="flex items-center space-x-4">
                  <input 
                    type="text"
                    className="flex-1 bg-cyber-bg border border-cyber-secondary/30 text-cyber-text p-4 rounded-xl focus:border-cyber-accent focus:outline-none transition-colors"
                    placeholder="Enter secure transmission..."
                    ref={chatInputRef}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <button 
                    disabled={activeContact.status !== 'approved'}
                    onClick={sendMessage}
                    className="bg-cyber-neon text-cyber-bg p-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-cyber-secondary flex-col space-y-4">
              <Lock size={64} className="opacity-10" />
              <p className="text-lg tracking-widest uppercase">Select a secure contact to begin</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Global Animation Overlay */}
      <EncryptionVisualizer 
        isActive={visActive} 
        algorithm={visAlgo || userSettings?.default_algorithm || 'caesar'}
        originalText={visOrig}
        processedText={visProc}
        isEncrypting={visEncrypting}
        cipherKey={visKey}
      />
    </ScreenContainer>
  );
};
