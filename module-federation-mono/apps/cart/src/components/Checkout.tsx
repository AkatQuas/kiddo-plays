/**
 * Checkout Component - Exposed via Module Federation
 * Checkout form and summary
 */

import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Input
} from '@mf-monorepo/ui';
import { useCartStore } from '@mf-monorepo/utils';
import { ArrowLeft, CreditCard, Lock } from 'lucide-react';
import { useState } from 'react';

interface CheckoutProps {
  items?: any[]; // Keep for backward compatibility
  onClose?: () => void;
}

export default function Checkout({ onClose }: CheckoutProps) {
  const { cartItems, setCheckoutOpen } = useCartStore();
  const items = cartItems;
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    address: '',
    city: '',
    zip: '',
    cardNumber: '',
    expiry: '',
    cvv: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const shipping = subtotal > 100 ? 0 : 9.99;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsProcessing(false);
    alert('Order placed successfully!');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <button
          onClick={() => {
            if (onClose) onClose();
            else setCheckoutOpen(false);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Checkout</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: '2rem'
        }}
      >
        <div>
          <Card style={{ marginBottom: '1rem' }}>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <Input
                  name="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                />
                <Input
                  name="name"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
          </Card>

          <Card style={{ marginBottom: '1rem' }}>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <Input
                  name="address"
                  placeholder="Street address"
                  value={formData.address}
                  onChange={handleChange}
                />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem'
                  }}
                >
                  <Input
                    name="city"
                    placeholder="City"
                    value={formData.city}
                    onChange={handleChange}
                  />
                  <Input
                    name="zip"
                    placeholder="ZIP code"
                    value={formData.zip}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <CreditCard size={20} />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <Input
                    name="cardNumber"
                    placeholder="Card number"
                    value={formData.cardNumber}
                    onChange={handleChange}
                  />
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.75rem'
                    }}
                  >
                    <Input
                      name="expiry"
                      placeholder="MM/YY"
                      value={formData.expiry}
                      onChange={handleChange}
                    />
                    <Input
                      name="cvv"
                      placeholder="CVV"
                      value={formData.cvv}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card style={{ position: 'sticky', top: '1rem' }}>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  marginBottom: '1rem'
                }}
              >
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.875rem'
                    }}
                  >
                    <span>
                      {item.name} x{item.quantity}
                    </span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  borderTop: '1px solid #e5e7eb',
                  paddingTop: '0.75rem'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.875rem',
                    marginBottom: '0.25rem'
                  }}
                >
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.875rem',
                    marginBottom: '0.25rem'
                  }}
                >
                  <span>Shipping</span>
                  <span>
                    {shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.875rem',
                    marginBottom: '0.75rem'
                  }}
                >
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div
                  style={{
                    borderTop: '1px solid #e5e7eb',
                    paddingTop: '0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 700
                  }}
                >
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
              <Button
                style={{ width: '100%', marginTop: '1rem' }}
                onClick={handleSubmit}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Lock size={16} />
                    Processing...
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Lock size={16} />
                    Pay ${total.toFixed(2)}
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
