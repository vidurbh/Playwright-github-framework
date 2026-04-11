import { test as base } from '@playwright/test';
import { ProductPage } from '../pages/product.page';
import { getProduct } from '../api/product.api';
import { Product } from '../types/product';

type Fixtures = {
  product: Product;
  productPage: ProductPage;
};

export const test = base.extend<Fixtures>({

  // API fixture
  product: async ({ request }, use) => {
    const data = await getProduct(request, 1);
    await use(data);
  },

  // Page Object fixture
  productPage: async ({ page }, use) => {
    const pageObj = new ProductPage(page);
    await use(pageObj);
  },

});

export { expect } from '@playwright/test';