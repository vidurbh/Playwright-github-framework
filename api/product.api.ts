import { APIRequestContext } from "@playwright/test";
import { Product } from "../types/product";

export async function getProduct(
  request: APIRequestContext,
  productId: number
): Promise <Product> {
  const response = await request.get(`/products/${productId}`, {
  });

  if (!response.ok()) {
    throw new Error(`API failed with status ${response.status()}`);
  }

  const data = await response.json();
  return data;
}