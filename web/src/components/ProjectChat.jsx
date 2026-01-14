import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

const ProjectChat = ({ projectId, orgId, user, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [replyingTo, setReplyingTo] = useState(null); // { id, senderName, text }
    const messagesEndRef = useRef(null);

    // Swipe Logic
    const touchStart = useRef(null);
    const touchEnd = useRef(null);

    const onTouchStart = (e) => {
        touchEnd.current = null;
        touchStart.current = e.targetTouches[0].clientX;
    }

    const onTouchMove = (e) => {
        touchEnd.current = e.targetTouches[0].clientX;
    }

    const onTouchEnd = (msg) => {
        if (!touchStart.current || !touchEnd.current) return;
        const distance = touchStart.current - touchEnd.current;
        const isRightSwipe = distance < -50;

        if (isRightSwipe) {
            setReplyingTo(msg);
        }
    }

    useEffect(() => {
        if (!projectId || !orgId) return;

        const messagesRef = collection(db, 'companies', orgId, 'projects', projectId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [projectId, orgId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            const messageData = {
                text: newMessage,
                senderId: user.uid,
                senderName: user.displayName || 'Unknown',
                senderRole: user.role, // 'Admin', 'Employee', 'Client'
                createdAt: serverTimestamp()
            };

            if (replyingTo) {
                messageData.replyTo = {
                    id: replyingTo.id,
                    senderName: replyingTo.senderName,
                    text: replyingTo.text ? replyingTo.text.substring(0, 50) + (replyingTo.text.length > 50 ? '...' : '') : ''
                };
            }

            await addDoc(collection(db, 'companies', orgId, 'projects', projectId, 'messages'), messageData);


            // Update Project with last message for notifications
            await updateDoc(doc(db, 'companies', orgId, 'projects', projectId), {
                lastMessage: {
                    text: newMessage,
                    senderId: user.uid,
                    createdAt: new Date(), // using client time for immediate UI update, slightly inexact but fine for notif
                },
                lastMessageAt: serverTimestamp()
            });

            setNewMessage('');
            setReplyingTo(null);
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                <h3>Project Discussion</h3>
                {onClose && <button onClick={onClose} className="close-btn">×</button>}
            </div>

            <div className="messages-area">
                {messages.length === 0 ? (
                    <div className="empty-chat">No messages yet. Start the conversation!</div>
                ) : (
                    messages.map(msg => {
                        const isMe = msg.senderId === user.uid;
                        return (
                            <div
                                key={msg.id}
                                className={`message-bubble ${isMe ? 'me' : 'other'} ${msg.senderRole?.toLowerCase()}`}
                                onTouchStart={onTouchStart}
                                onTouchMove={onTouchMove}
                                onTouchEnd={() => onTouchEnd(msg)}
                            >
                                {!isMe && <div className="sender-name">{msg.senderName} <span className="role-tag">({msg.senderRole})</span></div>}

                                {msg.replyTo && (
                                    <div className="reply-context-bubble">
                                        <div className="reply-sender">{msg.replyTo.senderName}</div>
                                        <div className="reply-text">{msg.replyTo.text}</div>
                                    </div>
                                )}

                                <div className="message-text">{msg.text}</div>

                                <div className="message-footer">
                                    <div className="message-time">
                                        {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <button
                                        className="reply-btn-inline"
                                        onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); }}
                                        title="Reply"
                                    >
                                        ↩️
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-footer-wrapper">
                {replyingTo && (
                    <div className="reply-preview">
                        <div className="reply-info">
                            <span>Replying to <strong>{replyingTo.senderName}</strong></span>
                            <span className="reply-snippet">{replyingTo.text.substring(0, 40)}{replyingTo.text.length > 40 ? '...' : ''}</span>
                        </div>
                        <button onClick={() => setReplyingTo(null)}>×</button>
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="chat-input-area">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                    />
                    <button type="submit">Send</button>
                </form>

                <style>{`
                .chat-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    max-height: 100%;
                    background: #1e293b;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }
                .chat-header {
                    padding: 1rem;
                    background: rgba(30, 41, 59, 0.9);
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .chat-header h3 { margin: 0; color: white; font-size: 1.1rem; }
                .close-btn {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    font-size: 1.5rem;
                    cursor: pointer;
                }
                .messages-area {
                    flex: 1;
                    padding: 1rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    background: #0f172a;
                }
                .empty-chat {
                    text-align: center;
                    color: #64748b;
                    margin-top: 2rem;
                    font-style: italic;
                }
                .message-bubble {
                    max-width: 80%;
                    padding: 0.75rem 1rem;
                    border-radius: 12px;
                    font-size: 0.95rem;
                    position: relative;
                }
                .message-bubble.me {
                    align-self: flex-end;
                    background: #6366f1;
                    color: white;
                    border-bottom-right-radius: 2px;
                }
                .message-bubble.other {
                    align-self: flex-start;
                    background: #334155;
                    color: #e2e8f0;
                    border-bottom-left-radius: 2px;
                }
                .message-bubble.other.admin { border-left: 3px solid #f59e0b; }
                .message-bubble.other.client { border-left: 3px solid #10b981; }
                
                .sender-name {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    margin-bottom: 0.25rem;
                }
                .role-tag {
                    font-size: 0.7rem;
                    opacity: 0.7;
                }
                .message-time {
                    font-size: 0.7rem;
                    opacity: 0.7;
                    text-align: right;
                    margin-top: 0.25rem;
                }
                .me .message-time { color: rgba(255,255,255,0.8); }
                .other .message-time { color: #94a3b8; }

                .chat-input-area {
                    padding: 1rem;
                    background: rgba(30, 41, 59, 0.9);
                    display: flex;
                    gap: 0.75rem;
                    border-top: 1px solid rgba(255,255,255,0.1);
                }
                .chat-footer-wrapper {
                     background: rgba(30, 41, 59, 0.9);
                     border-top: 1px solid rgba(255,255,255,0.1);
                }
                .reply-preview {
                    padding: 0.5rem 1rem;
                    background: rgba(15, 23, 42, 0.5);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-left: 3px solid #6366f1;
                    margin: 0.5rem 1rem 0;
                    border-radius: 4px;
                }
                .reply-info {
                    display: flex;
                    flex-direction: column;
                    font-size: 0.8rem;
                    color: #cbd5e1;
                }
                .reply-snippet {
                    color: #94a3b8;
                    font-size: 0.75rem;
                }
                .reply-preview button {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    font-size: 1.2rem;
                    cursor: pointer;
                }
                
                .message-footer {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    gap: 0.5rem;
                    margin-top: 0.25rem;
                }
                .reply-btn-inline {
                    background: none;
                    border: none;
                    color: inherit;
                    opacity: 0.5;
                    cursor: pointer;
                    font-size: 0.9rem;
                    padding: 0;
                    line-height: 1;
                    transition: opacity 0.2s, transform 0.2s;
                }
                .reply-btn-inline:hover {
                    opacity: 1;
                    transform: scale(1.1);
                }
                .message-bubble:hover .reply-btn-inline {
                    opacity: 0.8;
                }
                .reply-context-bubble {
                    background: rgba(0,0,0,0.2);
                    padding: 0.5rem;
                    border-radius: 6px;
                    border-left: 3px solid rgba(255,255,255,0.3);
                    margin-bottom: 0.5rem;
                    font-size: 0.8rem;
                }
                .reply-sender {
                    font-weight: 600;
                    font-size: 0.75rem;
                    margin-bottom: 0.1rem;
                    opacity: 0.9;
                }
                .reply-text {
                    opacity: 0.7;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .chat-input-area input {
                    flex: 1;
                    padding: 0.75rem;
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: #0f172a;
                    color: white;
                    outline: none;
                }
                .chat-input-area input:focus { border-color: #6366f1; }
                .chat-input-area button {
                    padding: 0 1.5rem;
                    border-radius: 8px;
                    background: #6366f1;
                    color: white;
                    border: none;
                    cursor: pointer;
                    font-weight: 600;
                    transition: background 0.2s;
                }
                .chat-input-area button:hover { background: #4f46e5; }

                @media (max-width: 768px) {
                    .chat-input-area input {
                        font-size: 16px;
                    }
                    .chat-container {
                         border-radius: 0;
                    }
                    .close-btn {
                        padding: 10px;
                    }
                }
            `}</style>
            </div>
        </div>
    );
};

export default ProjectChat;
