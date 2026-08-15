import { describe, it, expect } from 'vitest';
import { filterProducts, getProductCategories } from './products';

const products = [
  { _id: '1', title: 'MacBook Pro', category: 'electronics', brand: 'Apple' },
  { _id: '2', title: 'iPhone 15', category: 'electronics', brand: 'Apple' },
  { _id: '3', title: 'Cotton Shirt', category: 'clothing' },
];

describe('filterProducts', () => {
  it('returns all products when no filters', () => {
    expect(filterProducts(products)).toHaveLength(3);
  });

  it('filters by search term (case-insensitive, trimmed)', () => {
    expect(filterProducts(products, { searchTerm: '  iphone ' })).toEqual([products[1]]);
  });

  it('filters by brand field', () => {
    expect(filterProducts(products, { searchTerm: 'apple' })).toEqual([products[0], products[1]]);
  });

  it('filters by category', () => {
    expect(filterProducts(products, { filterCategory: 'clothing' })).toEqual([products[2]]);
  });

  it('combines search and category', () => {
    expect(filterProducts(products, { searchTerm: 'mac', filterCategory: 'electronics' })).toEqual([products[0]]);
  });

  it('returns empty array when no matches', () => {
    expect(filterProducts(products, { searchTerm: 'nothing' })).toEqual([]);
  });
});

describe('getProductCategories', () => {
  it('returns unique sorted categories', () => {
    expect(getProductCategories(products)).toEqual(['clothing', 'electronics']);
  });
});