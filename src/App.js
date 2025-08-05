import React, { useState, useEffect } from 'react';

// Reusable Button Component
const Button = ({ children, onClick, className = '', disabled = false }) => (
  <button
    onClick={onClick}
    className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-60 transform active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    disabled={disabled}
  >
    {children}
  </button>
);

// Product Card Component
const ProductCard = ({ product, onAddToCart }) => (
  <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] border border-gray-100 cursor-pointer relative">
    <img
      src={product.imageUrl}
      alt={product.name}
      className="w-full h-48 object-cover rounded-lg mb-4 shadow-md border border-gray-200"
      onError={(e) => {
          e.target.onerror = null;
          e.target.src = `https://placehold.co/400x300/e0f2fe/075985?text=${encodeURIComponent(product.name)}`;
      }}
    />
    <span className="absolute top-8 left-8 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md transform -rotate-12">
      DEMO
    </span>
    <h3 className="text-xl font-extrabold text-gray-900 mb-2 leading-tight">{product.name}</h3>
    <p className="text-gray-600 text-sm mb-4 flex-grow">{product.description}</p>
    <div className="flex items-center justify-between w-full mt-auto pt-4 border-t border-gray-100">
      <span className="text-3xl font-extrabold text-indigo-700 tracking-tight">${product.price.toFixed(2)}</span>
      <Button onClick={() => onAddToCart(product)} className="bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 text-base">
        Add to Cart
      </Button>
    </div>
  </div>
);

// Checkout Page Component
const CheckoutPage = ({ cartItems, onRemoveFromCart, onUpdateQuantity, onCheckout, onBackToProducts }) => {
  const [customerInfo, setCustomerInfo] = useState({ name: '', phoneCode: '+855', phoneNumber: '', address: '' });
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'error' });
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  const countryCodes = [
    { code: '+855', name: 'KH', flag: '🇰🇭' }, { code: '+66', name: 'TH', flag: '🇹🇭' },
    { code: '+84', name: 'VN', flag: '🇻🇳' }, { code: '+86', name: 'CN', flag: '🇨🇳' },
    { code: '+81', name: 'JP', flag: '🇯🇵' }, { code: '+82', name: 'KR', flag: '🇰🇷' },
    { code: '+1', name: 'US', flag: '🇺🇸' }, { code: '+44', name: 'UK', flag: '🇬🇧' },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCustomerInfo(prev => ({ ...prev, [name]: value }));
  };

  const showNotification = (message, type = 'error') => {
    setNotification({ show: true, message, type });
  };

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => setNotification({ show: false, message: '', type: 'error' }), 7000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleCheckout = async () => {
    if (cartItems.length === 0) return showNotification('Your cart is empty!');
    if (!customerInfo.name.trim() || !customerInfo.phoneNumber.trim() || !customerInfo.address.trim()) return showNotification('Please fill in all customer details.');
    if (!selectedDeliveryMethod) return showNotification('Please select a delivery method.');
    if (!selectedPaymentMethod) return showNotification('Please select a payment method.');
    if (selectedPaymentMethod === 'cash_on_delivery' && selectedDeliveryMethod !== 'in_siem_reap') {
      return showNotification('Cash on Delivery is only available for "In Siem Reap" delivery.');
    }

    setIsProcessingOrder(true);
    const fullPhoneNumber = customerInfo.phoneCode + customerInfo.phoneNumber.trim();
    const telegram = window.Telegram?.WebApp;
    
    const orderDetails = {
      customerInfo: { ...customerInfo, phone: fullPhoneNumber },
      items: cartItems.map(({ id, name, price, quantity }) => ({ id, name, price, quantity })),
      total: calculateTotal(),
      deliveryMethod: selectedDeliveryMethod,
      paymentMethod: selectedPaymentMethod,
      telegramInitData: telegram ? telegram.initData : null,
    };

    try {
      const response = await fetch('/.netlify/functions/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderDetails),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.message || 'An unknown error occurred.');
      
      showNotification(`Order successful! You should receive an invoice in Telegram shortly.`, 'success');
      if (telegram) {
        // Send a message back to the bot if you want
        telegram.sendData(JSON.stringify({ type: 'order_success', orderId: result.orderId }));
        // Close the web app on success
        telegram.close();
      }
      onCheckout();

    } catch (error) {
      console.error('Error during checkout:', error);
      showNotification(`An error occurred: ${error.message}. Please try again.`);
    } finally {
      setIsProcessingOrder(false);
    }
  };

  const calculateTotal = () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const isCheckoutDisabled = isProcessingOrder || cartItems.length === 0 || !customerInfo.name.trim() || !customerInfo.phoneNumber.trim() || !customerInfo.address.trim() || !selectedDeliveryMethod || !selectedPaymentMethod;

  return (
    <div className="bg-white p-4 sm:p-7 rounded-2xl shadow-2xl border border-blue-100 min-w-[300px] w-full max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-7 pb-4 border-b border-blue-50">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-800">Your Cart</h2>
        <Button onClick={onBackToProducts} className="bg-gray-200 text-gray-800 hover:bg-gray-300 text-base">← Back</Button>
      </div>

      {notification.show && (
        <div className={`p-4 rounded-lg mb-5 text-center font-medium border ${notification.type === 'success' ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'}`}>
          {notification.message}
        </div>
      )}

      {cartItems.length === 0 ? (
        <p className="text-gray-500 text-center py-12 text-lg">Your cart is empty.</p>
      ) : (
        <>
          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Items</h3>
            <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-blue-50 p-4 rounded-xl shadow-sm">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-gray-800 truncate">{item.name}</p>
                    <p className="text-sm text-gray-600">${item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="bg-blue-200 text-blue-700 hover:bg-blue-300 text-xl w-8 h-8 flex items-center justify-center p-0 rounded-full" disabled={isProcessingOrder}>-</Button>
                    <span className="font-extrabold text-xl text-blue-800 w-8 text-center">{item.quantity}</span>
                    <Button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="bg-blue-200 text-blue-700 hover:bg-blue-300 text-xl w-8 h-8 flex items-center justify-center p-0 rounded-full" disabled={isProcessingOrder}>+</Button>
                    <Button onClick={() => onRemoveFromCart(item.id)} className="bg-red-200 text-red-700 hover:bg-red-300 text-sm py-1 px-3 ml-3" disabled={isProcessingOrder}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Delivery Information</h3>
            <div className="space-y-4">
              <input type="text" name="name" placeholder="Full Name" value={customerInfo.name} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-xl" required disabled={isProcessingOrder} />
              <div className="flex gap-2">
                <select name="phoneCode" value={customerInfo.phoneCode} onChange={handleInputChange} className="p-3 border border-gray-300 rounded-xl" disabled={isProcessingOrder}>
                  {countryCodes.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                </select>
                <input type="tel" name="phoneNumber" placeholder="Phone (e.g., 12345678)" value={customerInfo.phoneNumber} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-xl" required disabled={isProcessingOrder} />
              </div>
              <textarea name="address" placeholder="Delivery Address (Street, House No, City)" value={customerInfo.address} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-xl h-24 resize-none" required disabled={isProcessingOrder}></textarea>
            </div>
          </section>

          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Delivery & Payment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Delivery Method:</label>
                <div className="space-y-2">
                  {['in_siem_reap', 'virak_buntham', 'j_and_t'].map(method => (
                    <label key={method} className={`flex items-center p-3 rounded-xl cursor-pointer border ${selectedDeliveryMethod === method ? 'bg-indigo-100 border-indigo-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
                      <input type="radio" name="deliveryMethod" value={method} checked={selectedDeliveryMethod === method} onChange={(e) => setSelectedDeliveryMethod(e.target.value)} className="form-radio h-5 w-5 text-indigo-600 mr-3" disabled={isProcessingOrder} />
                      <span className="font-medium capitalize">{method.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Payment Method:</label>
                <div className="space-y-2">
                  <label className={`flex items-center p-3 rounded-xl cursor-pointer border ${selectedPaymentMethod === 'cash_on_delivery' ? 'bg-indigo-100 border-indigo-500' : 'bg-gray-50 hover:bg-gray-100'} ${selectedDeliveryMethod !== 'in_siem_reap' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input type="radio" name="paymentMethod" value="cash_on_delivery" checked={selectedPaymentMethod === 'cash_on_delivery'} onChange={(e) => setSelectedPaymentMethod(e.target.value)} className="form-radio h-5 w-5 text-indigo-600 mr-3" disabled={isProcessingOrder || selectedDeliveryMethod !== 'in_siem_reap'} />
                    <span className="font-medium">Cash on Delivery</span>
                  </label>
                  <label className={`flex items-center p-3 rounded-xl cursor-pointer border ${selectedPaymentMethod === 'aba_bank' ? 'bg-indigo-100 border-indigo-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
                    <input type="radio" name="paymentMethod" value="aba_bank" checked={selectedPaymentMethod === 'aba_bank'} onChange={(e) => setSelectedPaymentMethod(e.target.value)} className="form-radio h-5 w-5 text-indigo-600 mr-3" disabled={isProcessingOrder} />
                    <span className="font-medium">ABA Bank Transfer</span>
                  </label>
                </div>
              </div>
            </div>
            {selectedPaymentMethod === 'aba_bank' && (
              <div className="bg-blue-50 p-4 rounded-lg mt-4 text-sm text-blue-800 border border-blue-200">
                <p className="font-semibold">ABA Account: 001 234 567 (PSYGERHUB)</p>
                <p className="mt-1">Please send a screenshot of your transaction via Telegram after placing the order.</p>
              </div>
            )}
          </section>

          <div className="border-t border-gray-200 pt-6 mt-8">
            <div className="flex justify-between items-center text-3xl font-extrabold text-blue-900 mb-6">
              <span>Total:</span>
              <span>${calculateTotal().toFixed(2)}</span>
            </div>
            <Button onClick={handleCheckout} className="w-full bg-green-600 text-white text-xl py-4" disabled={isCheckoutDisabled}>
              {isProcessingOrder ? 'Placing Order...' : 'Place Order Now'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};


// Main App Component
const App = () => {
  const [products] = useState([
    { id: 1, name: 'Smartwatch Ultra 2', description: 'Next-gen health monitoring & GPS.', price: 120.99, imageUrl: 'https://i5.walmartimages.com/seo/Smart-Watch-Fits-for-Android-and-iPhone-EEEkit-Fitness-Health-Tracker-Waterproof-Smartwatch-for-Women-Men_819cb65b-8437-4eb3-aba1-ce6513dc8d58.312f5775b50ab18c130fe5a454149fa9.jpeg' },
    { id: 2, name: 'Pro Wireless Earbuds', description: 'Immersive sound with active noise cancellation.', price: 149.95, imageUrl: 'https://i5.walmartimages.com/seo/Powerbeats-Pro-Totally-Wireless-Earphones-with-Apple-H1-Headphone-Chip_229484d2-69cd-4fa2-9ca2-13ac59be2927_1.4b59216ef8c835cc473f461ef67a03ad.jpeg' },
    { id: 3, name: 'Compact Bluetooth Speaker', description: 'Portable power, vibrant sound, waterproof design.', price: 89.00, imageUrl: 'https://www.studioshake.co.uk/cdn/shop/products/1_c454fe5c-01d2-4d6b-a6f9-fe8a4fa57e3d.jpg?v=1630680362' },
    { id: 4, name: 'E-reader Horizon', description: 'Crystal-clear display, endless library in your pocket.', price: 219.00, imageUrl: 'https://s.yimg.com/ny/api/res/1.2/pGLRGClUGh1bvhm.8GfOFw--/YXBwaWQ9aGlnaGxhbmRlcjt3PTY0MDtoPTM4NA--/https://s.yimg.com/os/creatr-uploaded-images/2024-05/df0bfaa0-17ad-11ef-a7fb-d7fc1e6e9473' },
  ]);

  const [cartItems, setCartItems] = useState([]);
  const [currentPage, setCurrentPage] = useState('products'); // 'products' or 'cart'

  useEffect(() => {
    const telegram = window.Telegram?.WebApp;
    if (telegram) {
      telegram.ready();
      telegram.expand();
    }
  }, []);

  const handleAddToCart = (productToAdd) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === productToAdd.id);
      return existingItem
        ? prevItems.map(item => item.id === productToAdd.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...prevItems, { ...productToAdd, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId, newQuantity) => {
    setCartItems(prevItems => newQuantity <= 0
      ? prevItems.filter(item => item.id !== productId)
      : prevItems.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item)
    );
  };

  const handleCheckoutSuccess = () => {
    setCartItems([]);
    // The web app is closed by the checkout component on success
  };

  const totalCartItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 py-6 px-4 sm:px-6 lg:px-8 font-inter">
      <style>{`
        .form-radio { -webkit-appearance: none; appearance: none; display: inline-block; vertical-align: middle; background-origin: border-box; user-select: none; flex-shrink: 0; height: 1.25rem; width: 1.25rem; color: #4f46e5; background-color: #fff; border-color: #d1d5db; border-width: 2px; border-radius: 100%; }
        .form-radio:checked { background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='8' cy='8' r='3'/%3e%3c/svg%3e"); border-color: transparent; background-color: currentColor; background-size: 100% 100%; }
        @keyframes bounce-sm { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .animate-bounce-sm { animation: bounce-sm 1s ease-in-out infinite; }
      `}</style>

      <div className="max-w-7xl mx-auto">
        <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur-sm p-4 rounded-b-2xl shadow-lg mb-8 flex justify-between items-center border-b border-gray-100 z-50">
          <h1 className="text-2xl font-extrabold text-indigo-900 tracking-tight">PsygerHub</h1>
          {currentPage === 'products' && (
            <Button onClick={() => setCurrentPage('cart')} className="bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              My Cart
              {totalCartItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-bounce-sm">
                  {totalCartItems}
                </span>
              )}
            </Button>
          )}
        </header>

        <main className="pt-24">
          {currentPage === 'products' ? (
            <section>
              <h2 className="text-4xl font-extrabold text-gray-800 mb-4 text-center">Our Products</h2>
              <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto text-center">
                These items are for demonstration. Add them to your cart and try the checkout process.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {products.map(product => <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />)}
              </div>
            </section>
          ) : (
            <CheckoutPage
              cartItems={cartItems}
              onRemoveFromCart={(id) => setCartItems(items => items.filter(i => i.id !== id))}
              onUpdateQuantity={handleUpdateQuantity}
              onCheckout={handleCheckoutSuccess}
              onBackToProducts={() => setCurrentPage('products')}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
