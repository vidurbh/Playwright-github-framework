import { Page } from '@playwright/test';
import { Product } from '../types/product';

export class ProductPage {
  constructor(private page: Page) {}

  async setProductUI(data: Product) {
    await this.page.setContent(`
      <h1 id="title">${data.title}</h1>
      <p id="price">${data.price}</p>
    `);
  }

  getTitle() {
    return this.page.locator('#title');
  }

  getPrice() {
    return this.page.locator('#price');
  }
}