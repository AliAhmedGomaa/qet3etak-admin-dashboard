export type ChatSenderRole = string;

export interface ChatMessage {
  id: string;
  shopId: string;
  senderId: string;
  senderRole: ChatSenderRole;
  text: string;
  read: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatConversation {
  id: string;
  shopId: string;
  shopName: string;
  kind?: 'SHOP' | 'EMPLOYEE';
  lastMessage: string;
  lastMessageAt: string | null;
  unreadForAdmin: number;
  unreadForShop: number;
}
