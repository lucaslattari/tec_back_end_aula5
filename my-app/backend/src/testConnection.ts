import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function test() {
    // Busca todos os produtos
    const products = await prisma.product.findMany()

    // Veja a mágica: o TypeScript conhece TODOS os campos!
    products.forEach(product => {
        console.log(`${product.title} - R$ ${product.price}`)
        // Se você tentar acessar product.naoExiste, o TypeScript reclama!
    })
}

test()
