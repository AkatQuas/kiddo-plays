export type IBook = {
  id: number;
  title: string;
  author: string;
  rating: number;
  price: number;
};

export type ICartItem = {
  id: number;
  description: string;
  cost: number;
};

export type ICart = {
  items: ICartItem[];
};
