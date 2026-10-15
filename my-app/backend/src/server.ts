import 'dotenv/config'
import express, {
    Request,
    Response,
    NextFunction
} from 'express'
import cors from 'cors' // Por que já ativar CORS? Quando integrar o front, isso evita erro de navegador. 
// Mantém simples e previsível.
import { PrismaClient, Prisma } from '@prisma/client'
import { z, ZodError } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// Cria uma instância da aplicação Express
const app = express();
const prisma = new PrismaClient()

// CORS básico para dev (front em Vite)
const FRONTEND_URL =
    process.env.FRONTEND_URL ||
    'http://localhost:5173'

app.use(cors({ origin: FRONTEND_URL }))
app.use(express.json()) // necessário para ler req.body em JSON

/**
 * Schemas Zod
 * - createProductSchema: criação (campos obrigatórios)
 * - updateProductSchema: atualização parcial (todos opcionais)
 */
// Schema de criação de produto
export const createProductSchema = z.object({
    title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
    description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
    // coerce: tenta converter "2800" (string) em número antes de validar positive()
    price: z.coerce.number().positive('Preço deve ser maior que zero'),
    imageUrl: z.string().min(1, 'imageUrl não pode ser vazio'),
    isFeatured: z.coerce.boolean().optional().default(false), // true/false/"true"/"false"
})

const updateProductSchema = createProductSchema.partial()

const addCartItemSchema = z.object({
    productId: z.coerce
        .number()
        .int('ID do produto deve ser um número inteiro')
        .positive('ID do produto deve ser positivo')
})

// Schemas de validação para autenticação
const registerSchema = z.object({
    email: z.email('Email inválido'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
    name: z.string().optional()
})

const loginSchema = z.object({
    email: z.email('Email inválido'),
    password: z.string().min(1, 'Senha é obrigatória')
})

// Chave secreta para JWT (em produção, isso vai para variável de ambiente)
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
    throw new Error(
        'JWT_SECRET não está definida nas variáveis de ambiente'
    )
}

// Interface para estender o Request do Express
interface AuthRequest extends Request {
    user?: {
        id: number
        email: string
        name?: string | null
    }
}

/**
 * Middleware de autenticação
 * - Extrai token do header Authorization
 * - Verifica se token é válido
 * - Busca usuário no banco
 * - Anexa usuário à requisição para uso posterior
 */
const authMiddleware = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // 1. Extrair token do header Authorization
        const authHeader = req.headers.authorization

        if (!authHeader) {
            res.status(401).json({ error: 'Token de acesso não fornecido' })
            return
        }

        // Header deve ser: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        const token = authHeader.split(' ')[1]

        if (!token) {
            res.status(401).json({ error: 'Formato do token inválido' })
            return
        }

        // 2. Verificar se token é válido
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }

        // 3. Buscar usuário no banco
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, name: true } // Não buscar a senha
        })

        if (!user) {
            res.status(401).json({ error: 'Usuário não encontrado' })
            return
        }

        // 4. Anexar usuário à requisição
        req.user = user

        // 5. Continuar para a próxima função (rota final)
        next()

    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({ error: 'Token expirado' })
            return
        }

        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({ error: 'Token inválido' })
            return
        }

        res.status(500).json({ error: 'Erro interno do servidor' })
    }
}

// Rota simples só para conferir se o servidor está no ar
app.get('/', (_req: Request, res: Response) => {
    res.json({ ok: true, msg: 'API de Produtos no ar!' })
})

/**
 * GET /api/auth/me
 * - Rota protegida para verificar se token está funcionando
 * - Retorna informações do usuário logado
 */
app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res: Response) => {
    // Se chegou até aqui, o middleware já validou o token
    res.status(200).json({
        message: 'Usuário autenticado',
        user: req.user
    })
})

/**
 * POST /api/auth/register
 * - Valida os dados de entrada
 * - Verifica se o email já existe
 * - Cria hash da senha
 * - Salva usuário no banco
 * - Retorna token JWT
 */
app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
        // 1. Validar dados de entrada
        const { email, password, name } = registerSchema.parse(req.body)

        // 2. Verificar se usuário já existe
        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            res.status(400).json({ error: 'Email já está em uso' })
            return
        }

        // 3. Criar hash da senha (10 rounds é um bom padrão de segurança)
        const hashedPassword = await bcrypt.hash(password, 10)

        // 4. Criar usuário no banco
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name
            }
        })

        // 5. Gerar token JWT
        const token = jwt.sign(
            { userId: user.id }, // Payload: informações que queremos no token
            JWT_SECRET,
            { expiresIn: '7d' } // Token expira em 7 dias
        )

        // 6. Retornar sucesso (sem a senha!)
        res.status(201).json({
            message: 'Usuário criado com sucesso',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        })

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                error: error.issues[0]?.message ?? 'Dados inválidos'
            })
            return
        }
        res.status(500).json({ error: 'Erro interno do servidor' })
        return
    }
})

/**
 * POST /api/auth/login
 * - Valida os dados de entrada
 * - Busca usuário pelo email
 * - Compara senha fornecida com hash salvo
 * - Retorna token JWT se autenticação for bem-sucedida
 */
app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
        // 1. Validar dados de entrada
        const { email, password } = loginSchema.parse(req.body)

        // 2. Buscar usuário no banco
        const user = await prisma.user.findUnique({
            where: { email }
        })

        if (!user) {
            res.status(401).json({ error: 'Email ou senha incorretos' })
            return
        }

        // 3. Comparar senha fornecida com hash salvo
        const isPasswordValid = await bcrypt.compare(password, user.password)

        if (!isPasswordValid) {
            res.status(401).json({ error: 'Email ou senha incorretos' })
            return
        }

        // 4. Gerar token JWT
        const token = jwt.sign(
            { userId: user.id },
            JWT_SECRET,
            { expiresIn: '7d' }
        )

        // 5. Retornar sucesso
        res.status(200).json({
            message: 'Login realizado com sucesso',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        })
        return

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                error: error.issues[0]?.message ?? 'Dados inválidos'
            })
            return
        }
        res.status(500).json({ error: 'Erro interno do servidor' })
        return
    }
})

// ========================================
// ROTAS DO CARRINHO
// ========================================

/**
 * GET /api/cart
 * - Retorna o carrinho do usuário autenticado
 */
app.get(
    '/api/cart',
    authMiddleware,
    async (
        req: AuthRequest,
        res: Response
    ): Promise<void> => {

        try {
            const userId = req.user!.id

            const cart = await prisma.cart.findUnique({
                where: {
                    userId
                },
                include: {
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            })

            if (!cart) {
                res.status(200).json({
                    id: null,
                    items: [],
                    itemsCount: 0
                })
                return
            }

            const itemsCount =
                cart.items.reduce(
                    (total, item) =>
                        total + item.quantity,
                    0
                )

            res.status(200).json({
                ...cart,
                itemsCount
            })

        } catch (error) {

            console.error(
                'GET /api/cart error:',
                error
            )

            res.status(500).json({
                error: 'Erro ao buscar carrinho'
            })
        }
    }
)

/**
 * POST /api/cart/items
 * - Adiciona uma unidade de um produto ao carrinho
 */
app.post('/api/cart/items', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id

        // 1. Validar entrada
        const { productId } = addCartItemSchema.parse(req.body)

        // 2. Verificar se o produto existe
        const product = await prisma.product.findUnique({
            where: { id: productId }
        })

        if (!product) {
            res.status(404).json({
                error: 'Produto não encontrado'
            })
            return
        }

        // 3. Buscar o carrinho do usuário ou criar um
        const cart = await prisma.cart.upsert({
            where: { userId },
            update: {},
            create: { userId }
        })

        // 4. Criar o item ou incrementar sua quantidade
        const item = await prisma.cartItem.upsert({
            where: {
                cartId_productId: {
                    cartId: cart.id,
                    productId
                }
            },
            update: {
                quantity: {
                    increment: 1
                }
            },
            create: {
                cartId: cart.id,
                productId,
                quantity: 1
            },
            include: {
                product: true
            }
        })

        res.status(200).json({
            message: 'Produto adicionado ao carrinho',
            item
        })
        return

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                error: 'Payload inválido',
                issues: error.issues.map((e) => ({
                    path: e.path.join('.'),
                    message: e.message
                }))
            })
            return
        }

        console.error('POST /api/cart/items error:', error)
        res.status(500).json({
            error: 'Erro ao adicionar produto ao carrinho'
        })
    }
})

/**
 * GET /api/products
 * - Busca todos os produtos direto no banco via Prisma
 * - Retorna um array de produtos
 */
app.get('/api/products', async (_req: Request, res: Response) => {
    try {
        const products = await prisma.product.findMany()
        res.status(200).json(products)
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar produtos' })
    }
})

/**
 * GET /api/products/:id
 * - Converte o :id da URL para número
 * - Se o produto existir, retorna 200 com o produto
 * - Se não existir, retorna 404 com uma mensagem clara
 * - Se o id for inválido (NaN, negativo), retorna 400
 */
app.get('/api/products/:id', async (req: Request, res: Response) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'ID inválido. Use um inteiro positivo.' })
        return
    }

    try {
        const product = await prisma.product.findUnique({ where: { id } })
        if (!product) {
            res.status(404).json({ error: 'Produto não encontrado' })
            return
        }
        res.status(200).json(product)
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar produto' })
    }
})

// Atualizar as rotas existentes para usar o middleware

/**
 * POST /api/products - AGORA PROTEGIDA
 * - Apenas usuários autenticados podem criar produtos
 */
app.post('/api/products', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const data = createProductSchema.parse(req.body)

        const product = await prisma.product.create({
            data
        })

        res.status(201).json({
            message: 'Produto criado com sucesso',
            product
        })
        return
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.issues[0]?.message ?? 'Dados inválidos' })
            return
        }
        res.status(500).json({ error: 'Erro ao criar produto' })
    }
})

/**
 * PUT /api/products/:id - AGORA PROTEGIDA
 */
app.put(
    '/api/products/:id',
    authMiddleware,
    async (req: AuthRequest, res: Response): Promise<void> => {
        const id = Number(req.params.id)

        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({
                error: 'ID inválido. Use um inteiro positivo.'
            })
            return
        }

        try {
            const data = updateProductSchema.parse(req.body)

            const updated = await prisma.product.update({
                where: { id },
                data
            })

            res.status(200).json({
                message: 'Produto atualizado com sucesso',
                product: updated
            })
            return

        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Payload inválido',
                    issues: error.issues.map((e) => ({
                        path: e.path.join('.'),
                        message: e.message
                    }))
                })
                return
            }

            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                res.status(404).json({
                    error: 'Produto não encontrado'
                })
                return
            }

            console.error(
                `PUT /api/products/${req.params.id} error:`,
                error
            )

            res.status(500).json({
                error: 'Erro interno ao atualizar produto'
            })
        }
    }
)

/**
 * DELETE /api/products/:id - AGORA PROTEGIDA
 */
app.delete(
    '/api/products/:id',
    authMiddleware,
    async (req: AuthRequest, res: Response): Promise<void> => {
        const id = Number(req.params.id)

        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({
                error: 'ID inválido. Use um inteiro positivo.'
            })
            return
        }

        try {
            await prisma.product.delete({
                where: { id }
            })

            res.status(200).json({
                message: 'Produto deletado com sucesso'
            })
            return

        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                res.status(404).json({
                    error: 'Produto não encontrado'
                })
                return
            }

            console.error(
                `DELETE /api/products/${req.params.id} error:`,
                error
            )

            res.status(500).json({
                error: 'Erro interno ao deletar produto'
            })
        }
    }
)

/**
 * DELETE /api/cart/items/:productId
 * - Remove completamente um produto do carrinho autenticado
 */
app.delete(
    '/api/cart/items/:productId',
    authMiddleware,
    async (req: AuthRequest, res: Response): Promise<void> => {
        const userId = req.user!.id
        const productId = Number(req.params.productId)

        if (!Number.isInteger(productId) || productId <= 0) {
            res.status(400).json({
                error: 'ID do produto inválido'
            })
            return
        }

        try {
            const cart = await prisma.cart.findUnique({
                where: { userId }
            })

            if (!cart) {
                res.status(404).json({
                    error: 'Produto não encontrado no carrinho'
                })
                return
            }

            const result = await prisma.cartItem.deleteMany({
                where: {
                    cartId: cart.id,
                    productId
                }
            })

            if (result.count === 0) {
                res.status(404).json({
                    error: 'Produto não encontrado no carrinho'
                })
                return
            }

            res.status(200).json({
                message: 'Produto removido do carrinho'
            })

        } catch (error) {
            console.error('DELETE /api/cart/items error:', error)

            res.status(500).json({
                error: 'Erro ao remover produto do carrinho'
            })
        }
    }
)

// Define a porta em que o servidor vai rodar
// Usamos 3001 para não conflitar com o front-end (que geralmente usa 3000 ou 5173)
const PORT = Number(process.env.PORT) || 3001

// Inicia o servidor e o faz "escutar" por requisições na porta definida
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando com sucesso em http://localhost:${PORT}`);
});

