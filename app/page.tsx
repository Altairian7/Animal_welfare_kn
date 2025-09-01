'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign,
  Clock,
  Package,
  ArrowUp,
  ArrowDown,
  Calendar,
  ShoppingCart,
  Bell,
  Eye,
  X
} from 'lucide-react';

// Simple types
interface Product {
  id: number;
  name: string;
  sku: string;
  current_stock: number;
  minimum_stock: number;
  predicted_demand: number;
  confidence_score: number;
  days_until_expiry: number;
  unit_price: number;
}

interface Alert {
  id: number;
  message: string;
  type: 'warning' | 'danger' | 'info';
  product: string;
}

const Dashboard = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Load sample data
  useEffect(() => {
    setTimeout(() => {
      setProducts([
        {
          id: 1,
          name: 'Paracetamol 500mg',
          sku: 'PAR500',
          current_stock: 45,
          minimum_stock: 20,
          predicted_demand: 65,
          confidence_score: 92,
          days_until_expiry: 45,
          unit_price: 5.99
        },
        {
          id: 2,
          name: 'Ibuprofen 400mg',
          sku: 'IBU400',
          current_stock: 12,
          minimum_stock: 15,
          predicted_demand: 25,
          confidence_score: 87,
          days_until_expiry: 12,
          unit_price: 8.99
        },
        {
          id: 3,
          name: 'Vitamin C 1000mg',
          sku: 'VITC1000',
          current_stock: 78,
          minimum_stock: 30,
          predicted_demand: 40,
          confidence_score: 94,
          days_until_expiry: 180,
          unit_price: 12.99
        },
        {
          id: 4,
          name: 'Cough Syrup',
          sku: 'COUGH01',
          current_stock: 8,
          minimum_stock: 10,
          predicted_demand: 18,
          confidence_score: 89,
          days_until_expiry: 8,
          unit_price: 15.99
        }
      ]);

      setAlerts([
        {
          id: 1,
          message: 'Cough Syrup expires in 8 days',
          type: 'danger',
          product: 'Cough Syrup'
        },
        {
          id: 2,
          message: 'Ibuprofen 400mg below minimum stock',
          type: 'warning',
          product: 'Ibuprofen 400mg'
        },
        {
          id: 3,
          message: 'High demand predicted for Paracetamol',
          type: 'info',
          product: 'Paracetamol 500mg'
        }
      ]);

      setLoading(false);
    }, 1000);
  }, []);

  // Simple calculations
  const totalProducts = products.length;
  const lowStockProducts = products.filter(p => p.current_stock <= p.minimum_stock).length;
  const expiringProducts = products.filter(p => p.days_until_expiry <= 30).length;
  const totalValue = products.reduce((sum, p) => sum + (p.current_stock * p.unit_price), 0);

  // Simple functions
  const getStockColor = (current: number, minimum: number) => {
    if (current <= minimum * 0.5) return 'text-red-600 bg-red-100';
    if (current <= minimum) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'danger': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const removeAlert = (id: number) => {
    setAlerts(alerts.filter(alert => alert.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Pharmacy Dashboard</h1>
            <div className="flex space-x-4">
              {['overview', 'inventory', 'predictions'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg capitalize ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">Total Products</p>
                <p className="text-2xl font-bold">{totalProducts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">Low Stock</p>
                <p className="text-2xl font-bold">{lowStockProducts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">Expiring Soon</p>
                <p className="text-2xl font-bold">{expiringProducts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">Total Value</p>
                <p className="text-2xl font-bold">${totalValue.toFixed(0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Simple Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Weekly Sales</h3>
              <div className="h-48 flex items-end space-x-2">
                {[42, 58, 45, 67, 52, 61, 48].map((value, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-blue-600 rounded-t"
                      style={{ height: `${(value / 70) * 150}px` }}
                    ></div>
                    <div className="text-xs mt-2 text-gray-500">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Alerts</h3>
                <div className="flex items-center">
                  <Bell className="h-5 w-5 text-gray-400" />
                  <span className="ml-1 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                    {alerts.length}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className={`p-3 rounded-lg border ${getAlertColor(alert.type)}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{alert.message}</p>
                        <p className="text-sm opacity-75">{alert.product}</p>
                      </div>
                      <button
                        onClick={() => removeAlert(alert.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Current Inventory</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Product</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Stock</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Expiry</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.sku}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>{product.current_stock} units</div>
                        <div className="text-sm text-gray-500">Min: {product.minimum_stock}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStockColor(product.current_stock, product.minimum_stock)}`}>
                          {product.current_stock <= product.minimum_stock * 0.5 ? 'Critical' : 
                           product.current_stock <= product.minimum_stock ? 'Low' : 'Good'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center ${product.days_until_expiry <= 30 ? 'text-red-600' : 'text-gray-900'}`}>
                          <Calendar className="h-4 w-4 mr-1" />
                          {product.days_until_expiry} days
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-800">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="text-green-600 hover:text-green-800">
                            <ShoppingCart className="h-4 w-4" />
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

        {activeTab === 'predictions' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Demand Predictions</h3>
            </div>
            <div className="p-6 space-y-4">
              {products.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div>
                      {product.predicted_demand > product.current_stock ? (
                        <ArrowUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <ArrowDown className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-500">
                        Current: {product.current_stock} | Predicted: {product.predicted_demand}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{product.confidence_score}% confidence</div>
                    <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${product.confidence_score}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700">
            <TrendingUp className="h-6 w-6 mb-2" />
            <div className="font-semibold">Generate Predictions</div>
          </button>
          <button className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700">
            <ShoppingCart className="h-6 w-6 mb-2" />
            <div className="font-semibold">Create Order</div>
          </button>
          <button className="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700">
            <BarChart3 className="h-6 w-6 mb-2" />
            <div className="font-semibold">View Reports</div>
          </button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
