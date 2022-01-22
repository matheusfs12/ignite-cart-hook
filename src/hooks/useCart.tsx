import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { Product, Stock } from '../types';

const localStorageCartKey = '@RocketShoes:cart';

interface CartProviderProps {
	children: ReactNode;
}

interface UpdateProductAmount {
	productId: number;
	amount: number;
}

interface CartContextData {
	cart: Product[];
	addProduct: (productId: number) => Promise<void>;
	removeProduct: (productId: number) => void;
	updateProductAmount: ({ productId, amount }: UpdateProductAmount) => void;
}

const setLocalStorageCart = (cart: Product[]) => {
	localStorage.setItem(localStorageCartKey, JSON.stringify(cart));
}

const getLocalStorageCart = (): Product[] => {
	const cart = localStorage.getItem(localStorageCartKey);
	if (cart) {
		return JSON.parse(cart);
	}

	return [];
}

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: CartProviderProps): JSX.Element {
	const [cart, setCart] = useState<Product[]>(() => {
		const storagedCart = getLocalStorageCart();

		if (storagedCart) {
			return storagedCart;
		}

		return [];
	});

	const getStock = useCallback(async (productId: number): Promise<number> => {
		const response = await api.get<Stock>(`/stock/${productId}`);
		return response.data.amount;
	}, []);

	const getProduct = useCallback(async (productId: number): Promise<Product> => {
		const response = await api.get<Product>(`/products/${productId}`);
		return response.data;
	}, []);

	const addProduct = async (productId: number) => {
		try {
			const updatedCart = [...cart];
			const productExists = cart.find(p => p.id === productId);

			const stockAmount = await getStock(productId);
			const amount = productExists ? (productExists.amount + 1) : 1;

			if (amount > stockAmount) {
				toast.error('Quantidade solicitada fora de estoque');
				return;
			}

			if (productExists) {
				productExists.amount = amount;
			} else {
				const product = await getProduct(productId);
				const newProduct = { ...product, amount: 1 };

				updatedCart.push(newProduct);
			}

			setCart(updatedCart);
			setLocalStorageCart(updatedCart);
		} catch (error: any) {
			toast.error('Erro na adição do produto');
		}
	};

	const removeProduct = (productId: number) => {
		try {
			const productExists = cart.find(p => p.id === productId);
			if (!productExists) {
				throw new Error('Erro na remoção do produto')
			}

			const newCart = cart.filter(p => p.id !== productId);

			setCart(newCart);
			setLocalStorageCart(newCart);
		} catch (error: any) {
			toast.error(error.message);
		}
	};

	const updateProductAmount = async ({ productId, amount }: UpdateProductAmount) => {
		try {
			if (amount <= 0) {
				return;
			}

			const stock = await getStock(productId);
			if (amount > stock) {
				toast.error('Quantidade solicitada fora de estoque');
				return;
			}

			const productExists = cart.find(p => p.id === productId);
			if (!productExists) {
				return;
			}

			productExists.amount = amount;

			const newCart = cart.map(product =>
				product.id === productId ? { ...product, amount } : product
			);

			setCart(newCart);
			setLocalStorageCart(newCart);
		} catch (error: any) {
			toast.error('Erro na alteração de quantidade do produto');
		}
	};

	return (
		<CartContext.Provider
			value={{ cart, addProduct, removeProduct, updateProductAmount }}
		>
			{children}
		</CartContext.Provider>
	);
}

export function useCart(): CartContextData {
	const context = useContext(CartContext);

	return context;
}
