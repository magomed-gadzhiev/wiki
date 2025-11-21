import { User } from './user.model';

export interface SectionSimple {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  created_at: string;
}

export interface CategorySimple {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  created_at: string;
}

export interface Section {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  created_at: string;
  categories: CategorySimple[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  section?: SectionSimple | null;
  sort_order: number;
  created_at: string;
}

export interface Tag {
  id?: string;
  name: string;
  slug?: string;
  created_at?: string;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  summary: string;
  category?: Category | null;
  tags: Tag[];
  author: User;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  view_count: number;
  can_view: User[];
  can_edit: User[];
  can_delete: User[];
  images: ArticleImage[];
  option_values: ArticleOptionValue[];
  versions_count: number;
  latest_version?: ArticleVersion;
}

export interface ArticleVersion {
  id: string;
  article: string;
  title: string;
  content: string;
  summary: string;
  version_number: number;
  author: User;
  created_at: string;
  change_description: string;
}

export interface ArticleImage {
  id: string;
  image: string;
  image_url: string;
  alt_text: string;
  uploaded_at: string;
  uploaded_by: number;
}

export interface ArticleOption {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  created_at: string;
}

export interface ArticleOptionValue {
  id?: string;
  option: ArticleOption;
  option_id: string;
  value: string;
  created_at?: string;
  updated_at?: string;
}

