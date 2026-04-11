import { test, expect } from '../fixtures/baseFixture';

const productIds=[1,2,3,4]

for (const id of productIds){


test(`Verify product ${id}`, async ({ product, productPage }) => {
  
  expect(typeof product.price).toBe('number');
  expect(product.price).toBeGreaterThan(0);

  await productPage.setProductUI(product);

  await expect(productPage.getTitle()).toHaveText(product.title);
  await expect(productPage.getPrice()).toHaveText(product.price.toString())   

})};


test('Invalid product ID returns error', async ({ request }) => {
  const response = await request.get('https://dummyjson.com/products/999999');
  expect(response.status()).toBe(404);
});


test('Search API returns relevant results', async ({ request }) => {
  const response = await request.get('https://dummyjson.com/products/search?q=phone');
  const data = await response.json();

  expect(data.products.length).toBeGreaterThan(0);
});