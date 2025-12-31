"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { materialsApi, Material } from "@/lib/api/materials";
import { inventoryApi } from "@/lib/api/inventory";
import { showToast } from "@/lib/utils/toast";
import React from "react";

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  weight: number;
  dimensions: string;
  totalStock: number;
  reorderPoint: number;
  status: string;
  imageUrl?: string;
}

export default function ProductsPage() {
  const { hasPermission } = useAdmin();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const canEdit = hasPermission(ADMIN_ROUTES.PRODUCTS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.PRODUCTS, "delete");

  // Load products from API
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        // Fetch materials with materialType='product'
        const materials = await materialsApi.getAll("product");
        
        // Fetch inventory for each material to get stock levels
        const productsWithInventory = await Promise.all(
          materials.map(async (material) => {
            try {
              const inventory = await inventoryApi.getByMaterial(material.id);
              const totalStock = inventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
              
              // Extract category from description or use default
              const category = material.description?.split(" ")[0] || "General";
              
              return {
                id: material.id,
                name: material.description || "Unknown",
                sku: material.materialCode,
                category: category,
                weight: 0, // Not available in materials API
                dimensions: "", // Not available in materials API
                totalStock: totalStock,
                reorderPoint: 10, // Default, can be enhanced later
                status: "active",
                imageUrl: undefined,
              };
            } catch (error) {
              console.error(`Error fetching inventory for ${material.id}:`, error);
              return {
                id: material.id,
                name: material.description || "Unknown",
                sku: material.materialCode,
                category: "General",
                weight: 0,
                dimensions: "",
                totalStock: 0,
                reorderPoint: 10,
                status: "active",
                imageUrl: undefined,
              };
            }
          })
        );
        
        setProducts(productsWithInventory);
      } catch (error) {
        console.error("Error loading products:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const summary = {
    totalProducts: products.length,
    categories: new Set(products.map(p => p.category)).size,
    lowStock: products.filter(p => p.totalStock < p.reorderPoint).length,
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = searchQuery.trim() === "" || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
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
      render: (product: Product) => (
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
      render: (product: Product) => (
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
      render: (product: Product) => (
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
      render: (product: Product) => (
        <span className={`badge ${product.status === "active" ? "badge-success" : "badge-error"}`}>
          {product.status === "active" ? "Active" : "Discontinued"}
        </span>
      ),
    },
  ];

  const renderActions = (product: Product) => (
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
        {canEdit && (
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
        )}
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
        {canDelete && (
          <li>
            <button 
              className="text-error"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedProduct(product);
                setShowDeleteModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Delete Product
            </button>
          </li>
        )}
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
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, SKU, or category..."
                className="input input-bordered input-sm w-64 pl-10 pr-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 text-sm pointer-events-none">
                search
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
                  type="button"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>
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
          <button 
            className="btn btn-sm btn-ghost"
            onClick={() => setShowImportModal(true)}
          >
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

      {/* Search Results Info */}
      {searchQuery && (
        <div className="text-sm text-base-content/60 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">search</span>
          <span>Found {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} matching "{searchQuery}"</span>
        </div>
      )}

      {/* Products Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <DataTable
          data={filteredProducts}
          columns={columns}
          keyExtractor={(product) => product.id}
          onRowClick={(product) => {
            setSelectedProduct(product);
            setShowDetailModal(true);
          }}
          actions={renderActions}
          emptyMessage={searchQuery ? `No products found matching "${searchQuery}"` : "No products found"}
        />
      )}

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
          onEdit={(product) => {
            setShowDetailModal(false);
            setSelectedProduct(null);
            setEditingProduct(product);
            setShowEditModal(true);
          }}
        />
      )}

      {/* Import Products Modal */}
      {showImportModal && (
        <ImportProductsModal onClose={() => setShowImportModal(false)} />
      )}

      {/* Delete Product Modal */}
      {selectedProduct && (
        <DeleteProductModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedProduct(null);
          }}
          onConfirm={() => {
            try {
              await materialsApi.delete(selectedProduct.id);
              showToast.success("Product deleted successfully");
              setShowDeleteModal(false);
              setSelectedProduct(null);
              // Reload data
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('reloadProducts'));
              }
            } catch (err) {
              console.error("Failed to delete product:", err);
              showToast.error(err instanceof Error ? err.message : "Failed to delete product");
            }
          }}
          product={selectedProduct}
        />
      )}

      {/* Listen for edit event from detail modal */}
      {typeof window !== 'undefined' && (
        <EditProductListener
          onEdit={(product) => {
            setShowDetailModal(false);
            setEditingProduct(product);
            setShowEditModal(true);
          }}
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const createData: Omit<Material, 'id'> = {
        materialCode: formData.sku,
        description: formData.description || formData.name,
        materialType: formData.category || "product",
        unitType: "unit", // Default
        storageType: formData.temperatureSensitive ? "cold" : "normal",
      };

      await materialsApi.create(createData);
      showToast.success("Product created successfully");
      onClose();
      // Reset form
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
      // Reload data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reloadProducts'));
      }
    } catch (err) {
      console.error("Failed to create product:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to create product");
    }
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
  product: Product;
}) {
  const [formData, setFormData] = useState({
    name: product.name,
    sku: product.sku,
    description: "",
    category: product.category,
    subcategory: "",
    weight: product.weight.toString(),
    dimensionsLength: product.dimensions.split("x")[0] || "",
    dimensionsWidth: product.dimensions.split("x")[1] || "",
    dimensionsHeight: product.dimensions.split("x")[2] || "",
    requiresQualityCheck: true,
    temperatureSensitive: false,
    fragile: false,
    reorderPoint: product.reorderPoint.toString(),
    optimalStockLevel: "",
    productImage: null as File | null,
    imagePreview: product.imageUrl || "",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, productImage: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imagePreview: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const updateData: Partial<Material> = {
        materialCode: formData.sku,
        description: formData.description || formData.name,
        materialType: formData.category || "product",
        storageType: formData.temperatureSensitive ? "cold" : "normal",
      };

      await materialsApi.update(product.id, updateData);
      showToast.success("Product updated successfully");
      onClose();
      // Reload data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reloadProducts'));
      }
    } catch (err) {
      console.error("Failed to update product:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to update product");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Product" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Product Image */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Product Image</span>
          </label>
          <div className="flex items-center gap-4">
            {formData.imagePreview && (
              <div className="w-24 h-24 bg-base-200 rounded-lg overflow-hidden">
                <img src={formData.imagePreview} alt="Product" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1">
              <input
                type="file"
                className="file-input file-input-bordered w-full"
                accept="image/*"
                onChange={handleFileChange}
              />
              <p className="text-xs text-base-content/60 mt-1">Upload new image to replace current</p>
            </div>
          </div>
        </div>

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
            Update Product
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Edit Product Event Listener Component
function EditProductListener({ onEdit }: { onEdit: (product: typeof products[0]) => void }) {
  useEffect(() => {
    const handleEdit = (event: CustomEvent) => {
      onEdit(event.detail);
    };
    window.addEventListener('editProduct' as any, handleEdit as EventListener);
    return () => {
      window.removeEventListener('editProduct' as any, handleEdit as EventListener);
    };
  }, [onEdit]);
  return null;
}

// Import Products Modal
function ImportProductsModal({ onClose }: { onClose: () => void }) {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"csv" | "excel">("csv");
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') {
        setImportFile(file);
        if (extension === 'csv') {
          setImportType('csv');
        } else {
          setImportType('excel');
        }
      } else {
        alert("Please select a CSV or Excel file");
      }
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      alert("Please select a file to import");
      return;
    }

    setImporting(true);
    try {
      // Read file content
      const text = await importFile.text();
      console.log("Importing products from file:", importFile.name);
      console.log("File content preview:", text.substring(0, 200));
      
      if (!importFile) {
        showToast.error("Please select a file to import");
        return;
      }

      try {
        setImporting(true);
        const result = await materialsApi.importCsv(importFile);
        
        if (result.errorCount > 0) {
          showToast.error(`Import completed with ${result.errorCount} errors. ${result.successCount} products imported.`);
        } else {
          showToast.success(`Successfully imported ${result.successCount} products`);
        }
        
        onClose();
        // Reload data
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('reloadProducts'));
        }
      } catch (err) {
        console.error("Failed to import products:", err);
        showToast.error(err instanceof Error ? err.message : "Failed to import products");
      } finally {
        setImporting(false);
      }
      
      alert("Products imported successfully!");
      setImportFile(null);
      onClose();
    } catch (error) {
      console.error("Error importing products:", error);
      alert("Error importing products. Please check the file format.");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    // Create CSV template
    const template = "Product Name,SKU,Category,Weight (kg),Dimensions (LxWxH cm),Reorder Point,Description\nWireless Earbuds,SKU-1001,Electronics,0.05,5x3x2,50,High-quality wireless earbuds";
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Import Products" size="lg">
      <div className="p-6 space-y-4">
        <div className="bg-info/10 border border-info/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-info">info</span>
            <div className="text-sm text-base-content/70">
              <p className="font-medium mb-1">Import Instructions:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Download the template CSV file</li>
                <li>Fill in product details following the template format</li>
                <li>Upload the completed file</li>
                <li>Supported formats: CSV, Excel (.xlsx, .xls)</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Import File *</span>
          </label>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="file-input file-input-bordered flex-1"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
            />
            <button
              type="button"
              className="btn btn-outline"
              onClick={downloadTemplate}
            >
              <span className="material-symbols-outlined">download</span>
              Download Template
            </button>
          </div>
          {importFile && (
            <div className="mt-2 text-sm text-base-content/70">
              Selected: <span className="font-medium">{importFile.name}</span> ({(importFile.size / 1024).toFixed(2)} KB)
            </div>
          )}
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">File Type</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="importType"
                value="csv"
                className="radio"
                checked={importType === "csv"}
                onChange={() => setImportType("csv")}
              />
              <span>CSV</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="importType"
                value="excel"
                className="radio"
                checked={importType === "excel"}
                onChange={() => setImportType("excel")}
              />
              <span>Excel</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button className="btn btn-ghost" onClick={onClose} disabled={importing}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!importFile || importing}
          >
            {importing ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Importing...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">upload_file</span>
                Import Products
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Product Detail Modal
function ProductDetailModal({
  isOpen,
  onClose,
  product,
  onEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onEdit?: (product: typeof products[0]) => void;
}) {
  const handleEdit = () => {
    onClose();
    // Trigger edit modal - this will be handled by parent component
    if (onEdit) {
      onEdit(product);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('editProduct', { detail: product }));
    }
  };

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
          <button className="btn btn-primary" onClick={handleEdit}>
            Edit Product
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

// Delete Product Modal
function DeleteProductModal({
  isOpen,
  onClose,
  onConfirm,
  product,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  product: Product;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Product" size="md">
      <div className="space-y-4">
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <h3 className="font-bold">
              Warning: This action cannot be undone!
            </h3>
            <div className="text-sm">
              You are about to delete <strong>{product.name}</strong> (SKU:{" "}
              {product.sku}). This will permanently remove the product from the
              system and all associated inventory data.
            </div>
          </div>
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <p className="text-sm text-base-content/70">
            <strong>Product Name:</strong> {product.name}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>SKU:</strong> {product.sku}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Category:</strong> {product.category}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Total Stock:</strong> {product.totalStock}
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-error" onClick={onConfirm}>
            <span className="material-symbols-outlined">delete</span>
            Delete Product
          </button>
        </div>
      </div>
    </Modal>
  );
}

