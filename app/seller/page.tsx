"use client";

import { useState, useEffect } from 'react';
import { 
  Search, Tag, ShoppingCart, Plus, Minus, Trash2, 
  CheckCircle, Loader2, ListTodo, AlertCircle, Sparkles, RefreshCw
} from 'lucide-react';
import { formatINR, SUPPORTED_UNITS, getConversionFactor, Unit } from '@/lib/conversion';

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

interface BasketItem {
  product: Product;
  quantity: number;
  orderedUnit: Unit;
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
  status: 'pending' | 'approved' | 'rejected';
  total_price: number;
  created_at: string;
  items: OrderItem[];
}

export default function SellerDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [activeView, setActiveView] = useState<'browse' | 'orders'>('browse');

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Order Basket
  const [basket, setBasket] = useState<BasketItem[]>([]);

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

      if (!prodRes.ok) throw new Error(prodData.error || 'Failed to load products');
      if (!ordRes.ok) throw new Error(ordData.error || 'Failed to load orders');

      setProducts(prodData.products || []);
      setOrders(ordData.orders || []);
    } catch (err: any) {
      setError(err.message || 'Error occurred fetching database data.');
    } finally {
      setLoading(false);
    }
  };

  const getCompatibleUnits = (baseUnit: string): Unit[] => {
    const info = SUPPORTED_UNITS[baseUnit as Unit];
    if (!info) return ['items'];
    return Object.entries(SUPPORTED_UNITS)
      .filter(([_, val]) => val.dimension === info.dimension)
      .map(([key]) => key as Unit);
  };

  const addToBasket = (product: Product) => {
    setSuccess('');
    setError('');
    const existingIndex = basket.findIndex(item => item.product.id === product.id);

    if (existingIndex > -1) {
      // Already in basket, increment by 1
      const updated = [...basket];
      updated[existingIndex].quantity += 1;
      setBasket(updated);
    } else {
      // Add new item with its own base unit as initial selection
      setBasket([...basket, {
        product,
        quantity: 1,
        orderedUnit: product.base_unit as Unit
      }]);
    }
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (isNaN(newQty) || newQty <= 0) return;
    const updated = [...basket];
    updated[index].quantity = newQty;
    setBasket(updated);
  };

  const updateUnit = (index: number, newUnit: Unit) => {
    const updated = [...basket];
    updated[index].orderedUnit = newUnit;
    setBasket(updated);
  };

  const removeFromBasket = (index: number) => {
    const updated = [...basket];
    updated.splice(index, 1);
    setBasket(updated);
  };

  const calculateItemPrice = (item: BasketItem): number => {
    const { product, quantity, orderedUnit } = item;
    if (isNaN(quantity) || quantity <= 0) return 0;
    try {
      const factor = getConversionFactor(orderedUnit, product.base_unit as Unit);
      return quantity * factor * product.base_price;
    } catch (err) {
      return 0;
    }
  };

  const getConversionBreakdown = (item: BasketItem): string => {
    const { product, quantity, orderedUnit } = item;
    if (isNaN(quantity) || quantity <= 0) return '';
    if (orderedUnit === product.base_unit) {
      return `Matches base unit (${product.base_unit})`;
    }
    try {
      const factor = getConversionFactor(orderedUnit, product.base_unit as Unit);
      const converted = quantity * factor;
      return `${quantity} ${orderedUnit} ➔ ${converted.toFixed(4)} ${product.base_unit} (Factor: ${factor})`;
    } catch (err) {
      return 'Incompatible dimension unit';
    }
  };

  const basketTotal = basket.reduce((acc, item) => acc + calculateItemPrice(item), 0);

  const handleSubmitOrder = async () => {
    if (basket.length === 0) return;
    setError('');
    setSuccess('');
    setSubmitLoading(true);

    const payload = {
      items: basket.map(item => ({
        productId: item.product.id,
        orderedQuantity: item.quantity,
        orderedUnit: item.orderedUnit
      }))
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order.');

      setSuccess(`Quotation placed successfully! Order ID: #${data.order.id}`);
      setBasket([]);
      fetchData();
      setActiveView('orders');
    } catch (err: any) {
      setError(err.message || 'Failed to place quotation.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Filter products
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Title block */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="page-title" className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            Seller Order Desk
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Browse products, select customized units, check live conversions, and place instant quotations.
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
          <div className="flex rounded-xl bg-zinc-100 p-0.5 dark:bg-zinc-900">
            <button
              onClick={() => setActiveView('browse')}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                activeView === 'browse'
                  ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <span>Catalog</span>
            </button>
            <button
              onClick={() => setActiveView('orders')}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                activeView === 'orders'
                  ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <ListTodo size={12} />
              <span>My Quotations ({orders.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messaging alerts */}
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

      {loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
          <span className="text-sm text-zinc-500">Syncing order catalog...</span>
        </div>
      ) : activeView === 'browse' ? (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Products Panel (Left) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products by name, SKU, tags..."
                  className="block w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 shadow-xs focus:border-emerald-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-700 shadow-xs focus:border-emerald-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-200 p-12 text-center dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-400">No products match search criteria</h3>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredProducts.map((p) => {
                  const isInStock = p.stock_quantity > 0;
                  return (
                    <div 
                      key={p.id}
                      className="group flex flex-col justify-between rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-emerald-900/40"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {p.category || 'General'}
                          </span>
                          <span className={`text-[10px] font-bold ${isInStock ? 'text-emerald-600' : 'text-red-500'}`}>
                            {isInStock ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {p.name}
                        </h3>
                        <p className="text-xs font-mono font-semibold text-zinc-400 mt-1">{p.sku}</p>
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                          {p.description || 'No description available.'}
                        </p>
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-zinc-50 pt-4 dark:border-zinc-800">
                        <div>
                          <p className="text-[10px] text-zinc-400">Base rate</p>
                          <p className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
                            {formatINR(p.base_price)} <span className="text-xs font-medium text-zinc-400">/ {p.base_unit}</span>
                          </p>
                        </div>

                        <button
                          onClick={() => addToBasket(p)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-50 text-zinc-700 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-emerald-600"
                          title="Add to quotation basket"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quotation Basket Panel (Right) */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/40 h-fit lg:sticky lg:top-24">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="text-emerald-600" size={20} />
                <span>Quotation Basket</span>
              </h2>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                {basket.length} items
              </span>
            </div>

            {basket.length === 0 ? (
              <div className="py-16 text-center text-zinc-400">
                <p>Basket is empty.</p>
                <p className="text-xs mt-1">Select items from the catalog on the left to request quote pricing.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {/* Basket list */}
                <div className="max-h-[380px] overflow-y-auto space-y-4 pr-1">
                  {basket.map((item, index) => {
                    const compatibleUnits = getCompatibleUnits(item.product.base_unit);
                    const itemPrice = calculateItemPrice(item);
                    return (
                      <div key={item.product.id} className="rounded-2xl border border-zinc-100 p-4 space-y-3 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{item.product.name}</h4>
                            <p className="text-[10px] text-zinc-400 font-mono">Rate: {formatINR(item.product.base_price)} / {item.product.base_unit}</p>
                          </div>
                          <button
                            onClick={() => removeFromBasket(index)}
                            className="text-zinc-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Quantity and Unit selector */}
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(index, parseFloat(e.target.value))}
                            className="w-20 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-xs text-center focus:border-emerald-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 font-mono"
                          />
                          <select
                            value={item.orderedUnit}
                            onChange={(e) => updateUnit(index, e.target.value as Unit)}
                            className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 font-mono"
                          >
                            {compatibleUnits.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>

                          <div className="flex-1 text-right">
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{formatINR(itemPrice)}</p>
                          </div>
                        </div>

                        {/* Conversion details indicator */}
                        <div className="rounded-lg bg-zinc-100 p-2 text-[10px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400 font-mono flex items-center gap-1">
                          <Sparkles size={10} className="text-emerald-600 shrink-0" />
                          <span>{getConversionBreakdown(item)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total display */}
                <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-500">Quotation Total</span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatINR(basketTotal)}</span>
                  </div>

                  <button
                    onClick={handleSubmitOrder}
                    disabled={submitLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500 focus:outline-hidden disabled:opacity-50 transition-all cursor-pointer hover:shadow-emerald-500/35"
                  >
                    {submitLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Placing Quotation...
                      </>
                    ) : (
                      <>
                        <span>Submit Order Quotation</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Quotation list history */
        <div className="space-y-6">
          {orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 p-12 text-center dark:border-zinc-800">
              <h3 className="text-lg font-bold text-zinc-400">No quotation logs placed yet</h3>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <div 
                  key={order.id} 
                  className="rounded-3xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  {/* Order header */}
                  <div className="flex flex-col gap-4 border-b border-zinc-100 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold">Quotation Reference: #{order.id}</h3>
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
                      <p className="mt-1 text-xs text-zinc-400">{new Date(order.created_at).toLocaleString('en-IN')}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-zinc-400">Grand Total</p>
                      <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{formatINR(order.total_price)}</p>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-400">
                      <thead className="bg-zinc-50/20 font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                          <th className="px-6 py-3">Product Name</th>
                          <th className="px-6 py-3 text-right">Requested Quantity</th>
                          <th className="px-6 py-3 text-center">Unit Calculation Breakdown</th>
                          <th className="px-6 py-3 text-right">Quotation Rate / Total</th>
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
                              <div className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-50 px-2.5 py-1 text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-300">
                                <span className="font-mono text-xs">
                                  {item.ordered_quantity} {item.ordered_unit} ➔ {(item.ordered_quantity * item.conversion_factor).toFixed(4)} {item.base_unit}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className="font-bold text-zinc-900 dark:text-zinc-50">{formatINR(item.calculated_price)}</p>
                              <p className="text-[10px] text-zinc-400">@ {formatINR(item.base_price)} / {item.base_unit}</p>
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
    </div>
  );
}
