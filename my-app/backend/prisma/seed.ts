// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Iniciando seed do banco de dados...')

    // Limpa a tabela antes de popular (útil em desenvolvimento)
    await prisma.product.deleteMany()

    // Cria produtos de exemplo
    const products = await prisma.product.createMany({
        data: [
            {
                title: "Notebook de Última Geração",
                description: "Um notebook poderoso para trabalho e lazer.",
                price: 4500.00,
                imageUrl: "/images/notebook.png",
                isFeatured: true
            },
            {
                title: "Smartphone Avançado",
                description: "Capture os melhores momentos com uma câmera de alta resolução.",
                price: 2800.00,
                imageUrl: "/images/smartphone.png",
                isFeatured: false
            },
            {
                title: "Teclado Mecânico RGB",
                description: "Alta performance e feedback tátil para gamers e programadores.",
                price: 350.50,
                imageUrl: "/images/teclado.png",
                isFeatured: true
            },
            {
                title: "Mouse Ergonômico Sem Fio",
                description: "Conforto e precisão para longas horas de uso.",
                price: 120.00,
                imageUrl: "/images/mouse.png",
                isFeatured: false
            },
            {
                title: "Monitor 4K HDR",
                description: "Cores vibrantes e detalhes impressionantes para profissionais.",
                price: 1899.99,
                imageUrl: "/images/monitor.png",
                isFeatured: true
            }
        ]
    })

    console.log(`✅ ${products.count} produtos criados com sucesso!`)
}

main()
    .catch((e) => {
        console.error('❌ Erro ao popular o banco:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })