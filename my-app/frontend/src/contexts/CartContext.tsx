// src/contexts/CartContext.tsx
import {
    createContext,
    useContext,
    useEffect,
    useState
} from 'react'

import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'

import {
    fetchCart,
    addCartItem as addCartItemApi,
    removeCartItem as removeCartItemApi
} from '../services/api'

// 1. Definir a interface - o "contrato" do nosso contexto
interface CartContextType {
    itemsCount: number
    addToCart: (productId: number) => Promise<void>
    removeFromCart: (productId: number) => Promise<void>
}

// 2. Criar o contexto - undefined por padrão
const CartContext = createContext<CartContextType | undefined>(undefined);

// 3. Criar o Provider - componente que "fornece" o contexto
interface CartProviderProps {
    children: ReactNode;  // Os componentes filhos que terão acesso ao contexto
}

export function CartProvider({ children }: CartProviderProps) {

    const { token } = useAuth()
    const [itemsCount, setItemsCount] =
        useState<number>(0)

    useEffect(() => {
        let cancelled = false

        if (!token) {
            setItemsCount(0)
            return
        }

        setItemsCount(0)

        const loadCart = async () => {
            try {
                const cart = await fetchCart(token)

                if (!cancelled) {
                    setItemsCount(cart.itemsCount)
                }

            } catch (error) {
                console.error(
                    'Erro ao carregar carrinho:',
                    error
                )

                if (!cancelled) {
                    setItemsCount(0)
                }
            }
        }

        void loadCart()

        return () => {
            cancelled = true
        }
    }, [token])

    // Função para adicionar item ao carrinho
    const addToCart = async (
        productId: number
    ): Promise<void> => {

        if (!token) {
            throw new Error(
                'Faça login para adicionar produtos ao carrinho'
            )
        }

        await addCartItemApi(token, productId)

        const cart = await fetchCart(token)

        setItemsCount(cart.itemsCount)
    }

    const removeFromCart = async (
        productId: number
    ): Promise<void> => {

        if (!token) {
            throw new Error(
                'Faça login para alterar o carrinho'
            )
        }

        await removeCartItemApi(token, productId)

        const cart = await fetchCart(token)
        setItemsCount(cart.itemsCount)
    }

    // Valor que será compartilhado
    const contextValue: CartContextType = {
        itemsCount,
        addToCart,
        removeFromCart
    }

    // Retornar o Provider com o valor
    return (
        <CartContext.Provider value={contextValue}>
            {children}
        </CartContext.Provider>
    );
}

// 4. Hook customizado para usar o contexto (boa prática!)
export function useCart() {
    const context = useContext(CartContext);

    // Verificação de segurança
    if (context === undefined) {
        throw new Error('useCart deve ser usado dentro de um CartProvider');
    }

    return context;
}

export { CartContext };