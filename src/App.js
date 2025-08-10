import React, { useState, useEffect } from 'react';

// --- HELPER COMPONENTS ---

const Button = ({ children, onClick, className = '', disabled = false }) => (
  <button
    onClick={onClick}
    className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-60 transform active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    disabled={disabled}
  >
    {children}
  </button>
);

// --- MAIN COMPONENTS ---

const ProductCard = ({ product, onAddToCart }) => (
  <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] border border-gray-100">
    <img src={product.imageUrl} alt={product.name} className="w-full h-48 object-cover rounded-lg mb-4 shadow-md" onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/400x300/e0f2fe/075985?text=${encodeURIComponent(product.name)}`}} />
    <h3 className="text-xl font-extrabold text-gray-900 mb-2">{product.name}</h3>
    <p className="text-gray-600 text-sm mb-4 flex-grow">{product.description}</p>
    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
      <span className="text-3xl font-extrabold text-indigo-700">${product.price.toFixed(2)}</span>
      <Button onClick={() => onAddToCart(product)} className="bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500">Add to Cart</Button>
    </div>
  </div>
);

const CheckoutPage = ({ cartItems, onRemoveFromCart, onUpdateQuantity, onBackToProducts, onCheckoutSuccess }) => {
  const [customerInfo, setCustomerInfo] = useState({ name: '', phoneCode: '+855', phoneNumber: '', address: '' });
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  const countryCodes = [ { code: '+855', name: 'KH', flag: '🇰🇭' } ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCustomerInfo(prev => ({ ...prev, [name]: value }));
  };

  const showNotification = (message) => {
    setNotification({ show: true, message });
  };

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => setNotification({ show: false, message: '' }), 7000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleCheckout = async () => {
    if (cartItems.length === 0) return showNotification('Your cart is empty!');
    if (!customerInfo.name.trim() || !customerInfo.phoneNumber.trim() || !customerInfo.address.trim()) return showNotification('Please fill in all customer details.');
    if (!selectedDeliveryMethod) return showNotification('Please select a delivery method.');
    if (!selectedPaymentMethod) return showNotification('Please select a payment method.');

    setIsProcessing(true);
    
    const telegram = window.Telegram?.WebApp;
    const fullPhoneNumber = customerInfo.phoneCode + customerInfo.phoneNumber.trim();
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
      if (!response.ok) throw new Error(result.message);

      if (selectedPaymentMethod === 'aba_payment_link') {
        window.location.href = result.paymentLink;
      } else {
        showNotification('Order placed successfully! We will contact you to confirm.');
        if (telegram) telegram.close();
        onCheckoutSuccess();
      }

    } catch (error) {
      console.error('Error during checkout:', error);
      showNotification(`Could not place order: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const calculateTotal = () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const isCheckoutDisabled = isProcessing || cartItems.length === 0 || !customerInfo.name.trim() || !customerInfo.phoneNumber.trim() || !customerInfo.address.trim() || !selectedDeliveryMethod || !selectedPaymentMethod;

  return (
      <div className="bg-white p-4 sm:p-7 rounded-2xl shadow-2xl border border-blue-100 w-full max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-7 pb-4 border-b border-blue-50">
          <h2 className="text-3xl font-extrabold text-blue-800">Your Cart</h2>
          <Button onClick={onBackToProducts} className="bg-gray-200 text-gray-800 hover:bg-gray-300">← Back</Button>
        </div>

        {notification.show && (
          <div className="p-4 rounded-lg mb-5 text-center font-medium border bg-red-100 border-red-400 text-red-700">
            {notification.message}
          </div>
        )}

        {cartItems.length > 0 && (
            <>
                <section className="mb-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Delivery Information</h3>
                    <div className="space-y-4">
                        <input type="text" name="name" placeholder="Full Name" value={customerInfo.name} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-xl" required disabled={isProcessing} />
                        <div className="flex gap-2">
                            <select name="phoneCode" value={customerInfo.phoneCode} onChange={handleInputChange} className="p-3 border border-gray-300 rounded-xl" disabled={isProcessing}>
                                {countryCodes.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                            </select>
                            <input type="tel" name="phoneNumber" placeholder="Phone (e.g., 12345678)" value={customerInfo.phoneNumber} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-xl" required disabled={isProcessing} />
                        </div>
                        <textarea name="address" placeholder="Delivery Address (Street, House No, City)" value={customerInfo.address} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-xl h-24 resize-none" required disabled={isProcessing}></textarea>
                    </div>
                </section>

                <section className="mb-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Delivery Method</h3>
                    <div className="space-y-2">
                        {['in_siem_reap', 'virak_buntham', 'j_and_t'].map(method => (
                            <label key={method} className={`flex items-center p-3 rounded-xl cursor-pointer border ${selectedDeliveryMethod === method ? 'bg-indigo-100 border-indigo-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
                                <input type="radio" name="deliveryMethod" value={method} checked={selectedDeliveryMethod === method} onChange={(e) => setSelectedDeliveryMethod(e.target.value)} className="form-radio h-5 w-5 text-indigo-600 mr-3" disabled={isProcessing} />
                                <span className="font-medium capitalize">{method.replace(/_/g, ' ')}</span>
                            </label>
                        ))}
                    </div>
                </section>
                
                <section className="mb-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Payment Method</h3>
                    <div className="space-y-2">
                        <label className={`flex items-center p-3 rounded-xl cursor-pointer border ${selectedPaymentMethod === 'cash_on_delivery' ? 'bg-indigo-100 border-indigo-500' : 'bg-gray-50 hover:bg-gray-100'} ${selectedDeliveryMethod !== 'in_siem_reap' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <input type="radio" name="paymentMethod" value="cash_on_delivery" onChange={(e) => setSelectedPaymentMethod(e.target.value)} className="form-radio h-5 w-5 text-indigo-600 mr-3" disabled={isProcessing || selectedDeliveryMethod !== 'in_siem_reap'} />
                            <span className="font-medium">Cash on Delivery</span>
                            {selectedDeliveryMethod !== 'in_siem_reap' && <span className="text-xs text-red-600 ml-2">(Only for In Siem Reap)</span>}
                        </label>
                        <label className={`flex items-center p-3 rounded-xl cursor-pointer border ${selectedPaymentMethod === 'aba_payment_link' ? 'bg-indigo-100 border-indigo-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
                            <input type="radio" name="paymentMethod" value="aba_payment_link" onChange={(e) => setSelectedPaymentMethod(e.target.value)} className="form-radio h-5 w-5 text-indigo-600 mr-3" disabled={isProcessing} />
                            <span className="font-medium">Pay with ABA Link</span>
                        </label>
                    </div>
                </section>
                
                {selectedPaymentMethod === 'aba_payment_link' && (
                    <div className="bg-blue-50 p-4 rounded-lg mt-4 text-center text-blue-800 border border-blue-200">
                        <p className="font-semibold">You will be redirected to the ABA payment page.</p>
                        <p className="mt-1 text-sm">Please enter the total amount manually and send us a screenshot of the transaction to confirm your order.</p>
                    </div>
                )}

                <div className="border-t border-gray-200 pt-6 mt-8">
                    <div className="flex justify-between items-center text-3xl font-extrabold text-blue-900 mb-6">
                        <span>Total:</span>
                        <span>${calculateTotal().toFixed(2)}</span>
                    </div>
                    <Button onClick={handleCheckout} className="w-full bg-green-600 text-white text-xl py-4" disabled={isCheckoutDisabled}>
                        {isProcessing ? 'Processing...' : 'Place Order Now'}
                    </Button>
                </div>
            </>
        )}
      </div>
  );
};

const App = ({ products }) => {
  const [cartItems, setCartItems] = useState([]);
  const [currentPage, setCurrentPage] = useState('products');

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
  }, []);

  const handleAddToCart = (productToAdd) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === productToAdd.id);
      return existing ? prev.map(item => item.id === productToAdd.id ? { ...item, quantity: item.quantity + 1 } : item) : [...prev, { ...productToAdd, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (id, quantity) => {
    setCartItems(prev => quantity <= 0 ? prev.filter(item => item.id !== id) : prev.map(item => item.id === id ? { ...item, quantity } : item));
  };

  const handleCheckoutSuccess = () => {
      setCartItems([]);
      setCurrentPage('products');
  };

  const totalCartItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 py-6 px-4 sm:px-6 lg:px-8 font-inter">
      <div className="max-w-7xl mx-auto">
        <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur-sm p-4 rounded-b-2xl shadow-lg flex justify-between items-center z-40">
          <h1 className="text-2xl font-extrabold text-indigo-900">PsygerHub</h1>
          {currentPage === 'products' && (
            <Button onClick={() => setCurrentPage('cart')} className="bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 relative">
              My Cart
              {totalCartItems > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">{totalCartItems}</span>}
            </Button>
          )}
        </header>

        <main className="pt-24">
          {currentPage === 'products' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {products.map(p => <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />)}
            </div>
          ) : (
            <CheckoutPage 
              cartItems={cartItems} 
              onRemoveFromCart={(id) => setCartItems(items => items.filter(i => i.id !== id))} 
              onUpdateQuantity={handleUpdateQuantity} 
              onBackToProducts={() => setCurrentPage('products')}
              onCheckoutSuccess={handleCheckoutSuccess}
            />
          )}
        </main>
      </div>
    </div>
  );
};

App.defaultProps = {
  products: [
    { id: 1, name: 'Smartwatch Ultra 2', description: 'Next-gen health monitoring & GPS.', price: 0.01, imageUrl: 'https://i5.walmartimages.com/seo/Smart-Watch-Fits-for-Android-and-iPhone-EEEkit-Fitness-Health-Tracker-Waterproof-Smartwatch-for-Women-Men_819cb65b-8437-4eb3-aba1-ce6513dc8d58.312f5775b50ab18c130fe5a454149fa9.jpeg' },
    { id: 2, name: 'Pro Wireless Earbuds', description: 'Immersive sound with active noise cancellation.', price: 0.01, imageUrl: 'https://i5.walmartimages.com/seo/Powerbeats-Pro-Totally-Wireless-Earphones-with-Apple-H1-Headphone-Chip_229484d2-69cd-4fa2-9ca2-13ac59be2927_1.4b59216ef8c835cc473f461ef67a03ad.jpeg' },
  ]
};

export default App;
