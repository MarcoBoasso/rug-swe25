/**
 * Types definition for the Pager application
 */

export interface Subcategory {
  name: string;
  path: string;
  description: string;
}

export interface Category {
  name: string;
  description: string;
  icon: string;
  color: string;
  subcategories: Subcategory[];
}

export interface CategoriesData {
  categories: Category[];
}