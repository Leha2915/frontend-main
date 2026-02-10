'use client'

import { Chat } from '@/lib/types'
import { cn } from '@/lib/utils'
import { FC, HTMLAttributes } from 'react'

interface ChatMessagesProps extends HTMLAttributes<HTMLDivElement> {
    chat: Chat
}

// Render message text with styled spans for [topic] and [Enter] markers
const renderMessageText = (text: string) => {
    const parts = text.split(/(\[topic\]|\[Enter\]|\n)/g);
    
    return parts.map((part, index) => {
        if (part === '[topic]') {
            return (
                <span key={index} className="font-mono text-xs bg-orange-50 border-orange-200 text-orange-700 px-2 py-1 rounded border">
                    topic
                </span>
            );
        } else if (part === '[Enter]') {
            return (
                <span key={index} className="font-mono text-xs bg-white px-2 py-1 rounded border">
                    Enter
                </span>
            );
        } else if (part === '\n') {
            return <br key={index} />;
        } else {
            return part;
        }
    });
};

const ChatMessages: FC<ChatMessagesProps> = ({ className, chat, ...props }) => {

    if (!chat) {
        return <div className="p-4 text-gray-500">Error, no chat available. Still in dev</div>;
    }

    const { messages } = chat
    const inverseMessages = [...messages].reverse()



    return (
        <div
            {...props}
            className={cn(
                'flex flex-1 flex-col-reverse gap-6 overflow-y-auto scrollbar-thumb-blue scrollbar-thumb-rounded scrollbar-track-blue-lighter scrollbar-w-2 scrolling-touch px-6 pb-6 pt-8',
                className
            )}>

            {inverseMessages.map((message) => {
                return (
                    <div className='chat-message' key={`${message.id}-${message.id}`}>
                        <div
                            className={cn('flex items-end gap-3', {
                                'justify-end': message.isUserMessage,
                            })}>
                            <div
                                className={cn('flex flex-col space-y-1 max-w-xs lg:max-w-md overflow-x-hidden', {
                                    'order-1 items-end': message.isUserMessage,
                                    'order-2 items-start': !message.isUserMessage,
                                })}>
                                <div
                                    className={cn('px-4 py-3 rounded-2xl text-sm leading-relaxed', {
                                        'bg-blue-600 text-white rounded-br-sm': message.isUserMessage,
                                        'bg-gray-100 text-gray-900 rounded-bl-sm': !message.isUserMessage,
                                    })}>
                                    {renderMessageText(message.text)}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}

        </div>
    )
}

export default ChatMessages
