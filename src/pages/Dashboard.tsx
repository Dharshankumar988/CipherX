import React, { useState, useEffect, useRef } from 'react';
import { ScreenContainer } from '../components/ScreenContainer';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Search, UserPlus, Check, X, Send, Lock, Trash2, ArrowLeft } from 'lucide-react';
import { EncryptionVisualizer } from '../components/EncryptionVisualizer';
import { encryptCaesar, decryptCaesar } from '../lib/ciphers/caesar';
import { encryptVigenere, decryptVigenere } from '../lib/ciphers/vigenere';
import { encryptAES, decryptAES } from '../lib/ciphers/aes';
import { encryptRSA, decryptRSA } from '../lib/ciphers/rsa';

const decryptMessage = (msg: any, currentUserId: string, myPrivateKey?: string) => {
  const algo = msg.algorithm_used;
  const key = msg.shift_key;
  if (algo === 'caesar') return decryptCaesar(msg.ciphertext, parseInt(key) || 3);
  if (algo === 'vigenere') return decryptVigenere(msg.ciphertext, key || 'KEY');
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
  
  const [messages, setMessages] = useState<any[]>([]);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  const [userSettings, setUserSettings] = useState<any>(null);
  
  // Visualizer state
  const [visActive, setVisActive] = useState(false);
  const [visEncrypting, setVisEncrypting] = useState(true);
  const [visOrig, setVisOrig] = useState('');
  const [visProc, setVisProc] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (session?.user.id) {
      fetchContacts();
      fetchSettings();
      setActiveContact(null);
      setMessages([]);
      setConversationId(null);
    }
  }, [session?.user.id]);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

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
      .select('id, email, username, display_name, rsa_public_key')
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
    
    setContacts(formatted);
  };

  const handleSearch = async () => {
    const searchEmail = searchInputRef.current?.value || '';
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

  const updateContactStatus = async (id: string, status: string) => {
    await supabase.from('contacts').update({ status }).eq('id', id);
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
    } else if (algo === 'vigenere') {
      ciphertext = encryptVigenere(inputText, shift || 'KEY');
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
      if (algo === 'rsa') {
        try {
          const parsed = JSON.parse(ciphertext);
          visProcText = parsed.recipient.substring(0, 40) + '...';
        } catch {}
      }
      setVisProc(visProcText);
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
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} className="bg-cyber-secondary/20 p-2 rounded text-cyber-text hover:text-cyber-neon"><Search size={18}/></button>
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
                      <div>
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
                {contacts.filter(c => c.status === 'approved').map(c => (
                  <button 
                    key={c.id}
                    onClick={() => setActiveContact(c)}
                    className={`w-full text-left p-3 rounded transition-colors ${activeContact?.id === c.id ? 'bg-cyber-neon/10 border-l-2 border-cyber-neon' : 'hover:bg-cyber-secondary/10'}`}
                  >
                    <p className="text-sm font-bold text-cyber-text">{c.other_user.display_name || c.other_user.username}</p>
                    <p className="text-xs text-cyber-secondary truncate">Secure channel active</p>
                  </button>
                ))}
              </div>
            </div>
            
             {/* Pending Outgoing */}
             {contacts.filter(c => c.status === 'pending' && c.requester_id === session?.user.id).length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-cyber-secondary uppercase mb-2">Sent Requests</h3>
                <div className="space-y-2">
                  {contacts.filter(c => c.status === 'pending' && c.requester_id === session?.user.id).map(c => (
                    <div key={c.id} className="bg-cyber-card p-2 rounded flex justify-between items-center">
                      <p className="text-xs text-cyber-secondary">{c.other_user.display_name || c.other_user.username}</p>
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
              <div className="h-16 border-b border-cyber-secondary/20 flex items-center px-6 bg-cyber-card/50">
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
        algorithm={userSettings?.default_algorithm || 'caesar'}
        originalText={visOrig}
        processedText={visProc}
        isEncrypting={visEncrypting}
      />
    </ScreenContainer>
  );
};
