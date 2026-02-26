export interface User {
  id: string;
  email: string;
  nickname: string;
  role: string;
  createdAt: string;
}

export interface Bar {
  id: string;
  name: string;
  description: string;
  category?: string;
  status: string;
  createdAt: string;
}

export interface Post {
  id: string;
  barId: string;
  bar?: Bar;
  authorId: string;
  author?: User;
  title: string;
  content: string;
  replyCount: number;
  lastReplyAt?: string;
  createdAt: string;
}

export interface Reply {
  id: string;
  postId: string;
  authorId: string;
  author?: User;
  floorNumber: number;
  content: string;
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
