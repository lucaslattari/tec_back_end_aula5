import React, { useState } from 'react';
import { ProductData } from './ProductCard';

export type ProductFormData = Omit<ProductData, 'id'>;

interface ProductFormProps {
    onAddProduct: (product: ProductFormData) => void;
}

function ProductForm({ onAddProduct }: ProductFormProps) {
    const [title, setTitle] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [price, setPrice] = useState<string>(''); // Usar string para input, converter depois
    const [imageUrl, setImageUrl] = useState<string>('');
    const [isFeatured, setIsFeatured] = useState<boolean>(false); // Adicionar se quiser controlar isso no form

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!title || !description || !price || !imageUrl) {
            alert("Por favor, preencha todos os campos.");
            return;
        }

        const newProductData: ProductFormData = {
            title,
            description,
            price: parseFloat(price) || 0,
            imageUrl,
            isFeatured,
        };

        onAddProduct(newProductData);

        // Limpar campos após submissão
        setTitle('');
        setDescription('');
        setPrice('');
        setImageUrl('');
        setIsFeatured(false);
    };

    return (
        <div className="card mb-4 p-3 shadow-sm">
            <h3 className="mb-3 text-center">Adicionar Novo Produto</h3> {/* Centralizado */}
            <form onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label htmlFor="title" className="form-label">Título</label>
                    <input
                        type="text"
                        className="form-control"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="description" className="form-label">Descrição</label>
                    <textarea
                        className="form-control"
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        rows={3}
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="price" className="form-label">Preço</label>
                    <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        id="price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="imageUrl" className="form-label">URL da Imagem</label>
                    <input
                        type="text"
                        className="form-control"
                        id="imageUrl"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="ex: images/meuproduto.png"
                        required
                    />
                </div>
                {<div className="mb-3 form-check">
                    <input
                        type="checkbox"
                        className="form-check-input"
                        id="isFeatured"
                        checked={isFeatured}
                        onChange={(e) => setIsFeatured(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="isFeatured">Produto em Destaque?</label>
                </div>
                }
                <button type="submit" className="btn btn-primary w-100">Adicionar Produto</button>
            </form>
        </div>
    );
}

export default ProductForm;