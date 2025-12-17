"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";

// Mock data - will be replaced with API calls
const products = [
  {
    id: "prod-1",
    name: "Wireless Earbuds",
    sku: "SKU-1001",
    category: "Electronics",
    weight: 0.05,
    dimensions: "5x3x2",
    totalStock: 240,
    reorderPoint: 50,
    status: "active",
    imageUrl: "/assets/products/earbuds.jpg",
  },
  {
    id: "prod-2",
    name: "Smart Projector",
    sku: "SKU-1002",
    category: "Electronics",
    weight: 2.5,
    dimensions: "30x25x15",
    totalStock: 45,
    reorderPoint: 10,
    status: "active",
    imageUrl: "/assets/products/projector.jpg",
  },
  {
    id: "prod-3",
    name: "Remote Control",
    sku: "SKU-2001",
    category: "Accessories",
    weight: 0.1,
    dimensions: "15x5x2",
    totalStock: 180,
    reorderPoint: 30,
    status: "active",
    imageUrl: "/assets/products/remote.jpg",
  },
  {
    id: "prod-4",
    name: "Smart Mug",
    sku: "SKU-1003",
    category: "Home & Kitchen",
    weight: 0.4,
    dimensions: "10x10x12",
    totalStock: 95,
    reorderPoint: 20,
    status: "active",
    imageUrl: "/assets/products/mug.jpg",
  },
];

export default function ProductsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<typeof products[0] | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<typeof products[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const summary = {
    totalProducts: 156,
    categories: 12,
    lowStock: 8,
  };

  const filteredProducts = products.filter((product) => {
    if (!searchQuery.trim() && categoryFilter === "all") return true;
    const matchesSearch = searchQuery.trim() === "" || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const summaryCards = [
    {
      label: "Total Products",
      value: summary.totalProducts,
      icon: "inventory_2",
      color: "primary" as const,
    },
    {
      label: "Categories",
      value: summary.categories,
      icon: "category",
      color: "info" as const,
    },
    {
      label: "Low Stock Items",
      value: summary.lowStock,
      icon: "warning",
      color: "warning" as const,
    },
  ];

  const columns = [
    {
      key: "image",
      label: "Image",
      render: (product: typeof products[0]) => (
        <div className="w-12 h-12 bg-base-200 rounded-lg flex items-center justify-center overflow-hidden">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-base-content/40">image</span>
          )}
        </div>
      ),
    },
    {
      key: "name",
      label: "Product Name",
      render: (product: typeof products[0]) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedProduct(product);
            setShowDetailModal(true);
          }}
          className="font-semibold text-primary hover:underline text-left"
        >
          {product.name}
        </button>
      ),
      sortable: true,
    },
    {
      key: "sku",
      label: "SKU",
      sortable: true,
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
    },
    {
      key: "weight",
      label: "Weight (kg)",
      render: (product: typeof products[0]) => `${product.weight} kg`,
      sortable: true,
    },
    {
      key: "dimensions",
      label: "Dimensions (cm)",
      className: "text-base-content/70",
    },
    {
      key: "totalStock",
      label: "Total Stock",
      render: (product: typeof products[0]) => (
        <span className={product.totalStock <= product.reorderPoint ? "text-warning font-semibold" : ""}>
          {product.totalStock}
        </span>
      ),
      sortable: true,
    },
    {
      key: "reorderPoint",
      label: "Reorder Point",
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (product: typeof products[0]) => (
        <span className={`badge ${product.status === "active" ? "badge-success" : "badge-error"}`}>
          {product.status === "active" ? "Active" : "Discontinued"}
        </span>
      ),
    },
  ];

  const renderActions = (product: typeof products[0]) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
      >
        <li>
          <button
            onClick={() => {
              setSelectedProduct(product);
              setShowDetailModal(true);
            }}
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            View Details
          </button>
        </li>
        <li>
          <button
            onClick={() => {
              setEditingProduct(product);
              setShowEditModal(true);
            }}
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            Edit Product
          </button>
        </li>
        <li>
          <button
            onClick={() => {
              // Navigate to inventory page filtered by this product
              window.location.href = `/admin/inventory?sku=${product.sku}`;
            }}
          >
            <span className="material-symbols-outlined text-sm">inventory</span>
            View Inventory
          </button>
        </li>
        <li>
          <button 
            className="text-error"
            onClick={() => {
              if (confirm(`Are you sure you want to delete ${product.name}?`)) {
                // TODO: API call to delete product
                console.log("Deleting product:", product.id);
              }
            }}
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            Delete Product
          </button>
        </li>
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Products</h1>
          <p className="text-sm text-base-content/60 mt-1">Manage product catalog and inventory</p>
        </div>
        <div className="flex gap-3">
          <div className="form-control">
            <input
              type="text"
              placeholder="Search products..."
              className="input input-bordered input-sm w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">filter_list</span>
              <span>Filter</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
            >
              <li>
                <button onClick={() => setCategoryFilter("all")}>All Categories</button>
              </li>
              <li>
                <button onClick={() => setCategoryFilter("Electronics")}>Electronics</button>
              </li>
              <li>
                <button onClick={() => setCategoryFilter("Accessories")}>Accessories</button>
              </li>
              <li>
                <button onClick={() => setCategoryFilter("Home & Kitchen")}>Home & Kitchen</button>
              </li>
            </ul>
          </div>
          <button className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">upload_file</span>
            <span>Import Products</span>
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="material-symbols-outlined">add</span>
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} columns={3} />

      {/* Products Table */}
      <DataTable
        data={filteredProducts}
        columns={columns}
        keyExtractor={(product) => product.id}
        onRowClick={(product) => {
          setSelectedProduct(product);
          setShowDetailModal(true);
        }}
        actions={renderActions}
        emptyMessage="No products found"
      />

      {/* Create Product Modal */}
      <CreateProductModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Edit Product Modal */}
      {editingProduct && (
        <EditProductModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingProduct(null);
          }}
          product={editingProduct}
        />
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
        />
      )}
    </div>
  );
}

// Create Product Modal
function CreateProductModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    description: "",
    category: "",
    subcategory: "",
    weight: "",
    dimensionsLength: "",
    dimensionsWidth: "",
    dimensionsHeight: "",
    requiresQualityCheck: true,
    temperatureSensitive: false,
    fragile: false,
    reorderPoint: "",
    optimalStockLevel: "",
    productImage: null as File | null,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to create product
    console.log("Creating product:", formData);
    onClose();
    setFormData({
      name: "",
      sku: "",
      description: "",
      category: "",
      subcategory: "",
      weight: "",
      dimensionsLength: "",
      dimensionsWidth: "",
      dimensionsHeight: "",
      requiresQualityCheck: true,
      temperatureSensitive: false,
      fragile: false,
      reorderPoint: "",
      optimalStockLevel: "",
      productImage: null,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Product" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Product Name *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">SKU *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Category *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
            >
              <option value="">Select category</option>
              <option value="Electronics">Electronics</option>
              <option value="Accessories">Accessories</option>
              <option value="Home & Kitchen">Home & Kitchen</option>
            </select>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Subcategory</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.subcategory}
            onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Description</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Product description..."
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Weight (kg) *</span>
          </label>
          <input
            type="number"
            step="0.01"
            className="input input-bordered w-full"
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
            required
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Dimensions (L x W x H in cm) *</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              step="0.1"
              className="input input-bordered"
              placeholder="Length"
              value={formData.dimensionsLength}
              onChange={(e) => setFormData({ ...formData, dimensionsLength: e.target.value })}
              required
            />
            <input
              type="number"
              step="0.1"
              className="input input-bordered"
              placeholder="Width"
              value={formData.dimensionsWidth}
              onChange={(e) => setFormData({ ...formData, dimensionsWidth: e.target.value })}
              required
            />
            <input
              type="number"
              step="0.1"
              className="input input-bordered"
              placeholder="Height"
              value={formData.dimensionsHeight}
              onChange={(e) => setFormData({ ...formData, dimensionsHeight: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Product Image</span>
          </label>
          <input
            type="file"
            className="file-input file-input-bordered w-full"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setFormData({ ...formData, productImage: file });
            }}
          />
        </div>

        <div className="space-y-2">
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={formData.requiresQualityCheck}
                onChange={(e) => setFormData({ ...formData, requiresQualityCheck: e.target.checked })}
              />
              <span className="label-text">Requires Quality Check</span>
            </label>
          </div>
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={formData.temperatureSensitive}
                onChange={(e) => setFormData({ ...formData, temperatureSensitive: e.target.checked })}
              />
              <span className="label-text">Temperature Sensitive</span>
            </label>
          </div>
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={formData.fragile}
                onChange={(e) => setFormData({ ...formData, fragile: e.target.checked })}
              />
              <span className="label-text">Fragile</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Reorder Point</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={formData.reorderPoint}
              onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Optimal Stock Level</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={formData.optimalStockLevel}
              onChange={(e) => setFormData({ ...formData, optimalStockLevel: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create Product
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Edit Product Modal
function EditProductModal({
  isOpen,
  onClose,
  product,
}: {
  isOpen: boolean;
  onClose: () => void;
  product: typeof products[0];
}) {
  const [formData, setFormData] = useState({
    name: product.name,
    sku: product.sku,
    category: product.category,
    reorderPoint: product.reorderPoint.toString(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to update product
    console.log("Updating product:", formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Product" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Product Name *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">SKU *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Category *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            required
          >
            <option value="Electronics">Electronics</option>
            <option value="Accessories">Accessories</option>
            <option value="Home & Kitchen">Home & Kitchen</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Reorder Point</span>
          </label>
          <input
            type="number"
            className="input input-bordered w-full"
            value={formData.reorderPoint}
            onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Update Product
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Product Detail Modal
function ProductDetailModal({
  isOpen,
  onClose,
  product,
}: {
  isOpen: boolean;
  onClose: () => void;
  product: typeof products[0];
}) {
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Product: ${product.name}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">SKU</label>
            <p className="font-semibold">{product.sku}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Category</label>
            <p className="font-semibold">{product.category}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Weight</label>
            <p className="font-semibold">{product.weight} kg</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Dimensions</label>
            <p className="font-semibold">{product.dimensions} cm</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Total Stock</label>
            <p className="font-semibold">{product.totalStock}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Reorder Point</label>
            <p className="font-semibold">{product.reorderPoint}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${product.status === "active" ? "badge-success" : "badge-error"}`}>
                {product.status === "active" ? "Active" : "Discontinued"}
              </span>
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary">
            Edit Product
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

