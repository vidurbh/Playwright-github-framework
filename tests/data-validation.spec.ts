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