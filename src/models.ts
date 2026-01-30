export interface Movie {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  year: number;
  director: string;
  duration: string;
  genre: string[];
  rate: number;
}

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

export interface Album {
  userId: number;
  id: number;
  title: string;
}

export interface Report {
  id: number;
  title: string;
  description: string;
  date: string;
}

export interface CommodityPaginate {
  first: number;
  prev: number | null;
  next: number | null;
  last: number;
  pages: number;
  items: number;
  data: Commodity[];
}

export interface Commodity {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Post {
  userId: string;
  id: string;
  title: string;
  body: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  address: {
    street: string;
    suite: string;
    city: string;
    zipcode: string;
    geo: {
      lat: string;
      lng: string;
    };
  };
  phone: string;
  website: string;
  company: {
    name: string;
    catchPhrase: string;
    bs: string;
  };
}
