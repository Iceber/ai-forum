export interface User {
  id: string;
  email: string;
  nickname: string;
  avatarUrl?: string | null;
  bio?: string | null;
  role: string;
  createdAt: string;
}

export interface Bar {
  id: string;
  name: string;
  description: string;
  avatarUrl?: string | null;
  rules?: string | null;
  category?: string;
  status: string;
  statusReason?: string | null;
  suspendUntil?: string | null;
  memberCount?: number;
  isMember?: boolean | null;
  memberRole?: string | null;
  createdBy?: { id: string; nickname: string } | null;
  createdAt: string;
  updatedAt?: string;
}

export interface Post {
  id: string;
  barId: string;
  bar?: Bar;
  authorId: string;
  author?: User;
  title: string;
  content: string;
  contentType?: 'plaintext' | 'markdown';
  replyCount: number;
  likeCount?: number;
  favoriteCount?: number;
  shareCount?: number;
  lastReplyAt?: string;
  status?: string;
  isLiked?: boolean | null;
  isFavorited?: boolean | null;
  createdAt: string;
  updatedAt?: string;
}

export interface Reply {
  id: string;
  postId: string;
  authorId: string;
  author?: User;
  floorNumber: number | null;
  content: string;
  contentType?: 'plaintext' | 'markdown';
  likeCount?: number;
  childCount?: number;
  isLiked?: boolean | null;
  isAuthor?: boolean;
  parentReplyId?: string | null;
  childPreview?: ChildReply[];
  createdAt: string;
}

export interface ChildReply {
  id: string;
  content: string;
  contentType?: 'plaintext' | 'markdown';
  author?: { id: string; nickname: string } | null;
  createdAt: string;
  likeCount?: number;
  isLiked?: boolean | null;
  isAuthor?: boolean;
  parentReplyId?: string | null;
  floorNumber?: number | null;
}

export interface BarMemberItem {
  id: string;
  userId: string;
  nickname: string | null;
  avatarUrl?: string | null;
  role: string;
  joinedAt: string;
}

export interface MyFavorite {
  id: string;
  postId: string;
  title: string;
  barName: string | null;
  authorNickname: string | null;
  favoritedAt: string;
}

export interface MyPost {
  id: string;
  title: string;
  barId: string;
  barName: string | null;
  replyCount: number;
  createdAt: string;
}

export interface MyReply {
  id: string;
  content: string;
  postId: string;
  postTitle: string | null;
  barName: string | null;
  floorNumber: number;
  createdAt: string;
}

export interface MyBar {
  id: string;
  name: string;
  description: string;
  status: string;
  statusReason?: string | null;
  suspendUntil?: string | null;
  memberCount: number;
  joinedAt: string;
}

export interface CreatedBar {
  id: string;
  name: string;
  status: string;
  statusReason?: string | null;
  suspendUntil?: string | null;
  createdAt: string;
}

export interface AdminAction {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string | null;
  adminId: string;
  adminNickname: string | null;
  reason: string | null;
  createdAt: string;
}

export interface PageMeta {
  cursor?: string;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  data: T | null;
  meta: PageMeta | null;
  error: { code: string; message: string } | null;
}
