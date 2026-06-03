"use client";

import { useState, useEffect } from 'react';
import { 
  Package, Plus, Edit2, Trash2, CheckCircle, XCircle, Search, 
  Tag, Info, ShoppingBag, Loader2, ArrowUpDown, AlertCircle, RefreshCw
} from 'lucide-react';
import { formatINR, SUPPORTED_UNITS, Unit } from '@/lib/conversion';

interface Product {
  id: number;
  name: string;
  sku: string;
  description: string;
  category: string;
  base_unit: string;
  base_price: number;
  stock_quantity: number;
}

interface OrderItem {
  id: number;
  product_name: string;
  product_sku: string;
  ordered_quantity: number;
  ordered_unit: string;
  base_unit: string;
  base_price: number;
  conversion_factor: number;
  calculated_price: number;
}

interface Order {
  id: number;
  user_name: string;
  user_email: string;
  status: 'pending' | 'approved' | 'rejected';
  total_price: number;
  created_at: string;
  items: OrderItem[];
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders'>('inventory');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Product modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodCat, setProdCat] = useState('');
  const [prodUnit, setProdUnit] = useState<Unit>('kg');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [prodRes, ordRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/orders')
      ]);

      const prodData = await prodRes.json();
      const ordData = await ordRes.json();

      if (!prodRes.ok) throw new Error(prodData.error || 'Failed to fetch products');
      if (!ordRes.ok) throw new Error(ordData.error || 'Failed to fetch orders');

      setProducts(prodData.products || []);
      setOrders(ordData.orders || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdSku('');
    setProdDesc('');
    setProdCat('');
    setProdUnit('kg');
    setProdPrice('');
    setProdStock('');
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdSku(p.sku);
    setProdDesc(p.description || '');
    setProdCat(p.category || '');
    setProdUnit(p.base_unit as Unit);
    setProdPrice(p.base_price.toString());
    setProdStock(p.stock_quantity.toString());
    setError('');
    setModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!prodName.trim() || !prodSku.trim() || !prodUnit) {
      setError('Please fill in Name, SKU, and Base Unit.');
      return;
    }

    const payload = {
      name: prodName,
      sku: prodSku,
      description: prodDesc,
      category: prodCat,
      base_unit: prodUnit,
      base_price: parseFloat(prodPrice) || 0,
      stock_quantity: parseFloat(prodStock) || 0,
    };

    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation failed');

      setSuccess(editingProduct ? 'Product updated successfully.' : 'Product created successfully.');
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save product.');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete product.');

      setSuccess('Product deleted successfully.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete product.');
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: 'approved' | 'rejected') => {
    setError('');
    setSuccess('');
    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order status');

      setSuccess(`Order status updated to ${status}.`);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to update order status.');
      // Scroll to error
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setActionLoading(null);
    }
  };

  // Compute categories
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Calculate statistics
  const totalCatalogValue = products.reduce((acc, p) => acc + (p.stock_quantity * p.base_price), 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Title block */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="page-title" className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            Control Dashboard
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time catalog control, decimal inventories, and incoming orders audit logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <RefreshCw size={16} />
            <span>Reload</span>
          </button>
          <button
            onClick={openCreateModal}
            id="btn-add-product"
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:bg-violet-500 cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Alert Messaging */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400 flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400 flex items-start gap-2.5">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Total Products</span>
            <div className="rounded-2xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <Package size={20} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold">{products.length}</h3>
            <p className="text-xs text-zinc-400 mt-1">Items currently in system</p>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Total Stock Value</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
              INR
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold">{formatINR(totalCatalogValue)}</h3>
            <p className="text-xs text-zinc-400 mt-1">Aggregated evaluation</p>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Pending Approvals</span>
            <div className="rounded-2xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <ShoppingBag size={20} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold">{pendingOrders}</h3>
            <p className="text-xs text-zinc-400 mt-1">Quotations awaiting approval</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`pb-4 text-sm font-bold border-b-2 px-1 transition-colors cursor-pointer ${
              activeTab === 'inventory'
                ? 'border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
            }`}
          >
            Inventory Catalog ({filteredProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-4 text-sm font-bold border-b-2 px-1 transition-colors cursor-pointer ${
              activeTab === 'orders'
                ? 'border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
            }`}
          >
            Quotation Logs ({orders.length})
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-violet-600" />
          <span className="text-sm text-zinc-500">Retrieving system states...</span>
        </div>
      ) : activeTab === 'inventory' ? (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                <Search size={18} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, SKU, category..."
                className="block w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 shadow-xs focus:border-violet-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-700 shadow-xs focus:border-violet-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Catalog Grid */}
          {filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 p-12 text-center dark:border-zinc-800">
              <Package className="mx-auto h-12 w-12 text-zinc-300" />
              <h3 className="mt-4 text-lg font-bold">No Products Found</h3>
              <p className="mt-1 text-sm text-zinc-500">Try adjusting your filters or add a new product.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
                  <thead className="bg-zinc-50/50 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/50 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-4">Product Details</th>
                      <th className="px-6 py-4">SKU / Code</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4 text-right">Base Pricing</th>
                      <th className="px-6 py-4 text-right">Available Inventory</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</p>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-[280px] truncate mt-0.5">{p.description || 'No description provided'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{p.sku}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                            <Tag size={10} />
                            {p.category || 'General'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-50">{formatINR(p.base_price)}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">per 1 {p.base_unit}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className={`font-mono font-semibold ${p.stock_quantity > 0 ? 'text-zinc-900 dark:text-zinc-50' : 'text-red-600'}`}>
                            {Number(p.stock_quantity).toFixed(4)}
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">{p.base_unit}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(p)}
                              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 cursor-pointer"
                              title="Edit product details"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/20 dark:hover:text-red-500 cursor-pointer"
                              title="Delete product"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Orders log view */}
          {orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 p-12 text-center dark:border-zinc-800">
              <ShoppingBag className="mx-auto h-12 w-12 text-zinc-300" />
              <h3 className="mt-4 text-lg font-bold">No Quotations Available</h3>
              <p className="mt-1 text-sm text-zinc-500">Sellers haven't placed any quotations/orders yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <div 
                  key={order.id} 
                  className="rounded-3xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  {/* Order Header */}
                  <div className="flex flex-col gap-4 border-b border-zinc-100 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-base font-bold">Order ID: #{order.id}</h3>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                          order.status === 'pending'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                            : order.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>Placed by: <strong className="text-zinc-700 dark:text-zinc-300">{order.user_name}</strong> ({order.user_email})</span>
                        <span className="mx-2">•</span>
                        <span>{new Date(order.created_at).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-zinc-400">Total Price</p>
                        <p className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">{formatINR(order.total_price)}</p>
                      </div>

                      {order.status === 'pending' && (
                        <div className="flex items-center gap-1.5 border-l border-zinc-200 pl-4 dark:border-zinc-800">
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'approved')}
                            disabled={actionLoading !== null}
                            className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle size={14} />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'rejected')}
                            disabled={actionLoading !== null}
                            className="flex items-center gap-1 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-500 disabled:opacity-50 cursor-pointer"
                          >
                            <XCircle size={14} />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-400">
                      <thead className="bg-zinc-50/20 font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                          <th className="px-6 py-3">Product details</th>
                          <th className="px-6 py-3 text-right">Ordered Quantities</th>
                          <th className="px-6 py-3 text-center">Conversion Audit</th>
                          <th className="px-6 py-3 text-right">Calculated Pricing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {order.items.map((item) => (
                          <tr key={item.id} className="hover:bg-zinc-50/10">
                            <td className="px-6 py-4">
                              <p className="font-semibold text-zinc-900 dark:text-zinc-50">{item.product_name}</p>
                              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">SKU: {item.product_sku}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className="font-semibold font-mono text-zinc-900 dark:text-zinc-50">{item.ordered_quantity}</p>
                              <p className="text-[10px] text-zinc-400">{item.ordered_unit}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="inline-flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-1.5 border border-zinc-100 dark:bg-zinc-900/60 dark:border-zinc-800">
                                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                  {item.ordered_quantity} {item.ordered_unit}
                                </span>
                                <span className="text-zinc-300 font-medium">➔</span>
                                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-200">
                                  {(item.ordered_quantity * item.conversion_factor).toFixed(4)} {item.base_unit}
                                </span>
                                <span className="text-zinc-400 text-[10px]">
                                  (Factor: {item.conversion_factor})
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className="font-bold text-zinc-900 dark:text-zinc-50">{formatINR(item.calculated_price)}</p>
                              <p className="text-[10px] text-zinc-400">
                                @ {formatINR(item.base_price)} / {item.base_unit}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Product Creation / Editing Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {editingProduct ? 'Edit Catalog Product' : 'Add New Product'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="e.g. Organic Basmati Rice"
                    className="mt-1.5 block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    required
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    placeholder="RICE-BAS-01"
                    className="mt-1.5 block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-mono focus:border-violet-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Category
                  </label>
                  <input
                    type="text"
                    value={prodCat}
                    onChange={(e) => setProdCat(e.target.value)}
                    placeholder="e.g. Grains"
                    className="mt-1.5 block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Base Unit
                  </label>
                  <select
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value as Unit)}
                    className="mt-1.5 block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    {Object.entries(SUPPORTED_UNITS).map(([key, value]) => (
                      <option key={key} value={key}>{value.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Base Price (INR)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="120.00"
                    className="mt-1.5 block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Initial Stock Level
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    placeholder="250.00"
                    className="mt-1.5 block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Description
                  </label>
                  <textarea
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    placeholder="Product descriptions..."
                    rows={3}
                    className="mt-1.5 block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 hover:bg-violet-500 cursor-pointer"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
