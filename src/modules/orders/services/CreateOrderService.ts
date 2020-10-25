import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) { }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {

    const customerExists = await this.customersRepository.findById(customer_id);
    if (!customerExists)
      throw new AppError('Customer was not found.');

    const productsExists = await this.productsRepository.findAllById(products);
    if (!productsExists.length)
      throw new AppError('Couldn\'t not find any products with given ids.');

    const productsExistsIds = productsExists.map(product => product.id);
    const checkInexistentProducts = products.filter(
      product => !productsExistsIds.includes(product.id)
    );

    if (checkInexistentProducts.length > 0)
      throw new AppError(`Couldn\'t not find this product(s): ${checkInexistentProducts[0].id}`);

    const findProductsWithNoQuantityAvaliable = products.filter(
      product =>
        productsExists.filter(p => p.id === product.id)[0].quantity < product.quantity
    );

    if (findProductsWithNoQuantityAvaliable.length)
      throw new AppError(`There is no enough quantity avaliable in product: ${findProductsWithNoQuantityAvaliable[0].id}`);

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsExists.filter(p => product.id === p.id)[0].price
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts
    });

    const { order_products } = order;

    const ordersProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        productsExists.filter(p => p.id === product.product_id)[0].quantity
        - product.quantity
    }));

    await this.productsRepository.updateQuantity(ordersProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
