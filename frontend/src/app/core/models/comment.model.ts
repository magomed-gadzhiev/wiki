import { User } from './user.model';

export interface Comment {
  id: string;
  article: string;
  author: User;
  content: string;
  parent?: string | null;
  referenced_comments: Comment[];
  replies: Comment[];
  replies_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommentCreate {
  article_id: string;
  content: string;
  parent_id?: string | null;
  referenced_comment_ids?: string[];
}

