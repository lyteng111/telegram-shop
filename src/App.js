import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';

// --- HELPER HOOKS & COMPONENTS ---

// Hook to detect if the user is on a mobile device
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const userAgent = typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
    const mobile = Boolean(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent));
    setIsMobile(mobile);
  }, []);
  return isMobile;
};

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

// Payment Modal for Desktop QR Code
const PaymentModal = ({ qrCode, amount, onCancel }) => (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 text-center max-w-sm w-full">
      <h2 className="text-2xl font-extrabold text-blue-800 mb-2">Scan to Pay</h2>
      <p className="text-gray-600 mb-5">Use any Cambodian banking app to scan the KHQR code below.</p>
      <div className="bg-white p-4 rounded-lg inline-block border-4 border-blue-200 shadow-inner">
        {qrCode ? <QRCode value={qrCode} size={200} /> : <div className="w-[200px] h-[200px] bg-gray-200 animate-pulse rounded-md" />}
      </div>
      <p className="text-4xl font-extrabold text-indigo-700 my-4">${amount.toFixed(2)}</p>
      <p className="text-sm text-gray-500 animate-pulse">Waiting for payment confirmation...</p>
      <Button onClick={onCancel} className="mt-6 bg-gray-200 text-gray-800 hover:bg-gray-300 w-full">
        Cancel Payment
      </Button>
    </div>
  </div>
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

const CheckoutPage = ({ cartItems, onRemoveFromCart, onUpdateQuantity, onCheckout, onBackToProducts }) => {
  const [customerInfo, setCustomerInfo] = useState({ name: '', phoneCode: '+855', phoneNumber: '', address: '' });
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'error' });
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({ qrCode: '', md5: '' });
  
  const isMobile = useIsMobile();
  const pollingInterval = useRef(null);

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

  const finalizeOrder = async () => {
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

      showNotification(`Order successful! You'll receive a confirmation in Telegram.`, 'success');
      if (telegram) telegram.close();
      onCheckout();

    } catch (error) {
      console.error('Error finalizing order:', error);
      showNotification(`Payment was successful, but there was an error confirming your order. Please contact support.`, 'error');
    }
  };

  const pollForPaymentStatus = (md5) => {
    pollingInterval.current = setInterval(async () => {
      try {
        const response = await fetch('/.netlify/functions/check-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ md5 }),
        });
        const result = await response.json();
        if (result.status === 'PAID') {
          clearInterval(pollingInterval.current);
          setShowPaymentModal(false);
          await finalizeOrder();
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    }, 3000);
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return showNotification('Your cart is empty!');
    if (!customerInfo.name.trim() || !customerInfo.phoneNumber.trim() || !customerInfo.address.trim()) return showNotification('Please fill in all customer details.');
    if (!selectedDeliveryMethod) return showNotification('Please select a delivery method.');
    if (!selectedPaymentMethod) return showNotification('Please select a payment method.');
    if (selectedPaymentMethod === 'cash_on_delivery' && selectedDeliveryMethod !== 'in_siem_reap') {
        return showNotification('Cash on Delivery is only available for "In Siem Reap" delivery.');
    }

    if (selectedPaymentMethod === 'cash_on_delivery') {
      setIsProcessing(true);
      await finalizeOrder();
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/.netlify/functions/generate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: calculateTotal(),
          isMobile: isMobile,
          billNumber: `ORD-${Date.now()}`
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      if (isMobile) {
        window.location.href = result.deepLink;
      } else {
        setPaymentData({ qrCode: result.qrCode, md5: result.md5 });
        setShowPaymentModal(true);
        pollForPaymentStatus(result.md5);
      }
    } catch (error) {
      console.error('Error generating payment:', error);
      showNotification(`Could not initiate Bakong payment: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const cancelPayment = () => {
    clearInterval(pollingInterval.current);
    setShowPaymentModal(false);
    setIsProcessing(false);
  };

  const calculateTotal = () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const isCheckoutDisabled = isProcessing || cartItems.length === 0 || !customerInfo.name.trim() || !customerInfo.phoneNumber.trim() || !customerInfo.address.trim() || !selectedDeliveryMethod || !selectedPaymentMethod;

  return (
    <>
      {showPaymentModal && <PaymentModal qrCode={paymentData.qrCode} amount={calculateTotal()} onCancel={cancelPayment} />}
      <div className="bg-white p-4 sm:p-7 rounded-2xl shadow-2xl border border-blue-100 w-full max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-7 pb-4 border-b border-blue-50">
          <h2 className="text-3xl font-extrabold text-blue-800">Your Cart</h2>
          <Button onClick={onBackToProducts} className="bg-gray-200 text-gray-800 hover:bg-gray-300">← Back</Button>
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
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Items in Cart</h3>
                    <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
                        {cartItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between bg-blue-50 p-4 rounded-xl shadow-sm">
                                <div className="flex-1 min-w-0 pr-2">
                                    <p className="font-bold text-gray-800 truncate">{item.name}</p>
                                    <p className="text-sm text-gray-600">${item.price.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="bg-blue-200 text-blue-700 hover:bg-blue-300 text-xl w-8 h-8 flex items-center justify-center p-0 rounded-full" disabled={isProcessing}>-</Button>
                                    <span className="font-extrabold text-xl text-blue-800 w-8 text-center">{item.quantity}</span>
                                    <Button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="bg-blue-200 text-blue-700 hover:bg-blue-300 text-xl w-8 h-8 flex items-center justify-center p-0 rounded-full" disabled={isProcessing}>+</Button>
                                    <Button onClick={() => onRemoveFromCart(item.id)} className="bg-red-200 text-red-700 hover:bg-red-300 text-sm py-1 px-3 ml-3" disabled={isProcessing}>Remove</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

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
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Delivery & Payment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">Delivery Method:</label>
                            <div className="space-y-2">
                                {['in_siem_reap', 'virak_buntham', 'j_and_t'].map(method => (
                                    <label key={method} className={`flex items-center p-3 rounded-xl cursor-pointer border ${selectedDeliveryMethod === method ? 'bg-indigo-100 border-indigo-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
                                        <input type="radio" name="deliveryMethod" value={method} checked={selectedDeliveryMethod === method} onChange={(e) => setSelectedDeliveryMethod(e.target.value)} className="form-radio h-5 w-5 text-indigo-600 mr-3" disabled={isProcessing} />
                                        <span className="font-medium capitalize">{method.replace(/_/g, ' ')}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">Payment Method:</label>
                            <div className="space-y-2">
                                <label className={`flex items-center p-3 rounded-xl cursor-pointer border ${selectedPaymentMethod === 'cash_on_delivery' ? 'bg-indigo-100 border-indigo-500' : 'bg-gray-50 hover:bg-gray-100'} ${selectedDeliveryMethod !== 'in_siem_reap' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <input type="radio" name="paymentMethod" value="cash_on_delivery" onChange={(e) => setSelectedPaymentMethod(e.target.value)} className="form-radio h-5 w-5 text-indigo-600 mr-3" disabled={isProcessing || selectedDeliveryMethod !== 'in_siem_reap'} />
                                    <span className="font-medium">Cash on Delivery</span>
                                </label>
                                <label className={`flex items-center p-3 rounded-xl cursor-pointer border ${selectedPaymentMethod === 'bakong_khqr' ? 'bg-indigo-100 border-indigo-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
                                    <input type="radio" name="paymentMethod" value="bakong_khqr" onChange={(e) => setSelectedPaymentMethod(e.target.value)} className="form-radio h-5 w-5 text-indigo-600 mr-3" disabled={isProcessing} />
                                    <span className="font-medium">Pay with Bakong (KHQR)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </section>

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
    </>
  );
};

// Main App Component
const App = () => {
  const [products] = useState([
    { id: 1, name: 'Smartwatch Ultra 2', description: 'Next-gen health monitoring & GPS.', price: 0.01, imageUrl: 'https://i5.walmartimages.com/seo/Smart-Watch-Fits-for-Android-and-iPhone-EEEkit-Fitness-Health-Tracker-Waterproof-Smartwatch-for-Women-Men_819cb65b-8437-4eb3-aba1-ce6513dc8d58.312f5775b50ab18c130fe5a454149fa9.jpeg' },
    { id: 2, name: 'Pro Wireless Earbuds', description: 'Immersive sound with active noise cancellation.', price: 0.01, imageUrl: 'https://i5.walmartimages.com/seo/Powerbeats-Pro-Totally-Wireless-Earphones-with-Apple-H1-Headphone-Chip_229484d2-69cd-4fa2-9ca2-13ac59be2927_1.4b59216ef8c835cc473f461ef67a03ad.jpeg' },
    { id: 3, name: 'Compact Bluetooth Speaker', description: 'Portable power, vibrant sound, waterproof design.', price: 0.01, imageUrl: 'https://www.studioshake.co.uk/cdn/shop/products/1_c454fe5c-01d2-4d6b-a6f9-fe8a4fa57e3d.jpg?v=1630680362' },
    { id: 4, name: 'E-reader Horizon', description: 'Crystal-clear display, endless library in your pocket.', price: 0.01, imageUrl: 'https://s.yimg.com/ny/api/res/1.2/pGLRGClUGh1bvhm.8GfOFw--/YXBwaWQ9aGlnaGxhbmRlcjt3PTY0MDtoPTM4NA--/https://s.yimg.com/os/creatr-uploaded-images/2024-05/df0bfaa0-17ad-11ef-a7fb-d7fc1e6e9473' },
  ]);

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
            <CheckoutPage cartItems={cartItems} onRemoveFromCart={(id) => setCartItems(items => items.filter(i => i.id !== id))} onUpdateQuantity={handleUpdateQuantity} onCheckout={handleCheckoutSuccess} onBackToProducts={() => setCurrentPage('products')} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
