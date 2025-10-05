import { educationQuotes } from '@/data/quotes';

export interface Quote {
  id: string;
  text: string;
  author: string;
  category: string;
  tags?: string[];
}

export const loadQuotesData = async (): Promise<Quote[]> => {
  return Promise.resolve(educationQuotes);
};

export const defaultQuotes: Quote[] = educationQuotes;